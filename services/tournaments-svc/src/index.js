import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { readFileSync } from 'fs';
import { parse } from 'graphql';
import { ApolloServer } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { expressMiddleware } from '@apollo/server/express4';
import neo4j from 'neo4j-driver';
import { requireOrganizerFromAuthHeader } from './auth.js';

const PORT = process.env.PORT || 4001;
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';

// GraphQL schema (parseamos SDL a AST para Apollo Subgraph)
const sdlString = readFileSync(new URL('../schema.graphql', import.meta.url), 'utf8');
const typeDefs = parse(sdlString);

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function stageSubtypeLabelFromFormat(format) {
  if (format === 'league') return 'LeagueStage';
  if (format === 'groups') return 'GroupStage';
  if (format === 'elimination') return 'EliminationStage';
  return 'ComposedStage';
}

async function upsertCompetitorSnapshot(session, {
  competitorId,
  kind,
  displayName,
  shortName,
  avatarUrl,
  badgeUrl,
}) {
  const updatedAt = new Date().toISOString();
  const res = await session.run(
    `MERGE (c:Competitor {id:$id})
     REMOVE c:Team:Participant
     SET c:Competitor
     FOREACH (_ IN CASE WHEN $kind = 'team' THEN [1] ELSE [] END | SET c:Team)
     FOREACH (_ IN CASE WHEN $kind = 'participant' THEN [1] ELSE [] END | SET c:Participant)
     ON CREATE SET
       c.kind = $kind,
       c.displayName = $displayName,
       c.shortName = $shortName,
       c.avatarUrl = $avatarUrl,
       c.badgeUrl = $badgeUrl,
       c.source = 'sql-snapshot',
       c.updatedAt = $updatedAt
     ON MATCH SET
       c.kind = coalesce($kind, c.kind),
       c.displayName = coalesce($displayName, c.displayName),
       c.shortName = coalesce($shortName, c.shortName),
       c.avatarUrl = coalesce($avatarUrl, c.avatarUrl),
       c.badgeUrl = coalesce($badgeUrl, c.badgeUrl),
       c.source = coalesce(c.source, 'sql-snapshot'),
       c.updatedAt = $updatedAt
     RETURN c`,
    {
      id: competitorId,
      kind,
      displayName,
      shortName: shortName ?? null,
      avatarUrl: avatarUrl ?? null,
      badgeUrl: badgeUrl ?? null,
      updatedAt,
    }
  );
  return res.records[0]?.get('c')?.properties;
}

function requireOrganizer(context) {
  return requireOrganizerFromAuthHeader(context?.headers?.authorization || '');
}

// Basic resolvers (mock con persistencia mínima en Neo4j)
const resolvers = {
  Query: {
    health: () => 'ok',
    version: () => '0.1.0',
    tournaments: async (_,_args,{ driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          'MATCH (t:Tournament) RETURN t ORDER BY t.name'
        );
        return res.records.map(r => {
          const t = r.get('t').properties;
          return {
            id: t.id,
            name: t.name,
            sport: t.sport ?? 'football',
            season: t.season ?? null,
            venue: t.venue ?? null,
            organizer: t.organizer ?? null,
            participantType: t.participantType ?? null,
            inscriptionMode: t.inscriptionMode ?? 'public',
            status: t.status ?? 'draft',
          };
        });
      } finally {
        await session.close();
      }
    },
    tournament: async (_,{ id },{ driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          'MATCH (t:Tournament {id:$id}) RETURN t',
          { id }
        );
        if (res.records.length === 0) return null;
        const t = res.records[0].get('t').properties;
        return {
          id: t.id,
          name: t.name,
          sport: t.sport ?? 'football',
          season: t.season ?? null,
          venue: t.venue ?? null,
          organizer: t.organizer ?? null,
          participantType: t.participantType ?? null,
          inscriptionMode: t.inscriptionMode ?? 'public',
          status: t.status ?? 'draft',
        };
      } finally {
        await session.close();
      }
    },
  },
  Mutation: {
    createTournament: async (_, { name, sport, season, venue, organizer, participantType, inscriptionMode, status }, context) => {
      requireOrganizer(context);
      if (!organizer || !organizer.trim()) {
        throw new Error('BAD_REQUEST: organizer requerido');
      }
      const id = genId('t');
      const session = context.driver.session();
      try {
        await session.run(
          'CREATE (t:Tournament {id:$id, name:$name, sport:$sport, season:$season, venue:$venue, organizer:$organizer, participantType:$pt, inscriptionMode:$inscriptionMode, status:$status}) RETURN t',
          {
            id,
            name,
            sport,
            season: season || null,
            venue: venue || null,
            organizer: organizer || null,
            pt: participantType || null,
            inscriptionMode,
            status,
          }
        );
        return {
          id,
          name,
          sport,
          season: season || null,
          venue: venue || null,
          organizer: organizer || null,
          participantType: participantType || null,
          inscriptionMode,
          status,
        };
      } finally {
        await session.close();
      }
    },
    // Persistencia mínima de Competition y relación con Tournament
    createCompetition: async (_, { tournamentId, name, order }, { driver }) => {
      const id = genId('c');
      const session = driver.session();
      try {
        await session.run(
          `MATCH (t:Tournament {id:$tid})
           CREATE (t)-[:HAS_COMPETITION {order:$order}]->(c:Competition {id:$id, name:$name, order:$order})
           RETURN c`,
          { tid: tournamentId, id, name, order }
        );
        return { id, name, order };
      } finally {
        await session.close();
      }
    },
    // Persistencia mínima de Stage y relación con Competition
    addStage: async (_, { competitionId, name, order, format, configJson, childrenJson }, { driver }) => {
      const id = genId('s');
      const subtype = stageSubtypeLabelFromFormat(format);
      const session = driver.session();
      try {
        const query =
          `MATCH (c:Competition {id:$cid})
           CREATE (c)-[:HAS_STAGE {order:$order}]->(st:Stage:${subtype} {id:$id, name:$name, order:$order, format:$format, configJson:$configJson, childrenJson:$childrenJson})
           RETURN st`;
        await session.run(
          query,
          {
            cid: competitionId,
            id,
            name,
            order,
            format,
            configJson: configJson ?? null,
            childrenJson: childrenJson ?? null,
          }
        );
        return {
          id,
          name,
          order,
          format,
          configJson: configJson ?? null,
          childrenJson: childrenJson ?? null,
        };
      } finally {
        await session.close();
      }
    },
    // Persistencia mínima de Transition (como nodo) y relaciones entre Stage origen/destino
    addTransitionTopN: async (_, { fromStageId, toStageId, topN }, { driver }) => {
      const id = genId('tr');
      const session = driver.session();
      try {
        const cycleCheck = await session.run(
          `MATCH (a:Stage {id:$from}), (b:Stage {id:$to})
           OPTIONAL MATCH p=(b)-[:ADVANCES_TO*1..]->(a)
           RETURN p IS NOT NULL AS hasCycle`,
          { from: fromStageId, to: toStageId }
        );
        if (cycleCheck.records[0]?.get('hasCycle')) {
          throw new Error('BAD_REQUEST: transición inválida, genera ciclo entre etapas');
        }
        await session.run(
          `MATCH (a:Stage {id:$from}), (b:Stage {id:$to})
           CREATE (a)-[:EMITS]->(tr:Transition {id:$id, type:'top', label:'avance', selectionKind:'top', topN:$n})-[:TO]->(b)
           CREATE (a)-[:HAS_TRANSITION]->(tr)
           CREATE (tr)-[:TO_STAGE]->(b)
           CREATE (a)-[:ADVANCES_TO]->(b)
           RETURN tr`,
          { from: fromStageId, to: toStageId, id, n: topN }
        );
        return { id, type: 'top', label: 'avance', selectionKind: 'top', topN };
      } finally {
        await session.close();
      }
    },
    addTransition: async (_, {
      fromStageId,
      toStageId,
      label,
      selectionKind,
      topN,
      rangeFrom,
      rangeTo,
      bottomN,
      toExternalTournamentId,
      toExternalStageId,
      toExternalTournamentName,
      carryOverJson,
    }, { driver }) => {
      const id = genId('tr');
      const session = driver.session();
      try {
        if (toStageId) {
          const cycleCheck = await session.run(
            `MATCH (a:Stage {id:$from}), (b:Stage {id:$to})
             OPTIONAL MATCH p=(b)-[:ADVANCES_TO*1..]->(a)
             RETURN p IS NOT NULL AS hasCycle`,
            { from: fromStageId, to: toStageId }
          );
          if (cycleCheck.records[0]?.get('hasCycle')) {
            throw new Error('BAD_REQUEST: transición inválida, genera ciclo entre etapas');
          }
          await session.run(
            `MATCH (a:Stage {id:$from}), (b:Stage {id:$to})
             CREATE (a)-[:EMITS]->(tr:Transition {
               id:$id,
               type:'generic',
               label:$label,
               selectionKind:$selectionKind,
               topN:$topN,
               rangeFrom:$rangeFrom,
               rangeTo:$rangeTo,
               bottomN:$bottomN,
               carryOverJson:$carryOverJson
             })-[:TO]->(b)
             CREATE (a)-[:HAS_TRANSITION]->(tr)
             CREATE (tr)-[:TO_STAGE]->(b)
             CREATE (a)-[:ADVANCES_TO]->(b)
             RETURN tr`,
            {
              from: fromStageId,
              to: toStageId,
              id,
              label,
              selectionKind,
              topN: topN ?? null,
              rangeFrom: rangeFrom ?? null,
              rangeTo: rangeTo ?? null,
              bottomN: bottomN ?? null,
              carryOverJson: carryOverJson ?? null,
            }
          );
        } else {
          await session.run(
            `MATCH (a:Stage {id:$from})
             CREATE (a)-[:EMITS]->(tr:Transition {
               id:$id,
               type:'external',
               label:$label,
               selectionKind:$selectionKind,
               topN:$topN,
               rangeFrom:$rangeFrom,
               rangeTo:$rangeTo,
               bottomN:$bottomN,
               toExternalTournamentId:$toExternalTournamentId,
               toExternalStageId:$toExternalStageId,
               toExternalTournamentName:$toExternalTournamentName,
               carryOverJson:$carryOverJson
             })
             RETURN tr`,
            {
              from: fromStageId,
              id,
              label,
              selectionKind,
              topN: topN ?? null,
              rangeFrom: rangeFrom ?? null,
              rangeTo: rangeTo ?? null,
              bottomN: bottomN ?? null,
              toExternalTournamentId: toExternalTournamentId ?? null,
              toExternalStageId: toExternalStageId ?? null,
              toExternalTournamentName: toExternalTournamentName ?? null,
              carryOverJson: carryOverJson ?? null,
            }
          );
        }
        return {
          id,
          type: toStageId ? 'generic' : 'external',
          label,
          selectionKind,
          topN: topN ?? null,
          rangeFrom: rangeFrom ?? null,
          rangeTo: rangeTo ?? null,
          bottomN: bottomN ?? null,
          toExternalTournamentId: toExternalTournamentId ?? null,
          toExternalStageId: toExternalStageId ?? null,
          toExternalTournamentName: toExternalTournamentName ?? null,
          carryOverJson: carryOverJson ?? null,
        };
      } finally {
        await session.close();
      }
    },
    addGroup: async (_, { stageId, name, order }, { driver }) => {
      const id = genId('g');
      const session = driver.session();
      try {
        await session.run(
          `MATCH (s:Stage {id:$stageId})
           CREATE (s)-[:HAS_GROUP {order:$order}]->(g:Group {id:$id, name:$name, order:$order})
           RETURN g`,
          { stageId, id, name, order }
        );
        return { id, name, order };
      } finally {
        await session.close();
      }
    },
    addTeamToGroup: async (_, { groupId, teamId }, { driver }) => {
      const session = driver.session();
      try {
        await upsertCompetitorSnapshot(session, {
          competitorId: teamId,
          kind: 'team',
          displayName: `Equipo ${teamId}`,
          shortName: null,
          avatarUrl: null,
          badgeUrl: null,
        });
        await session.run(
          `MATCH (g:Group {id:$groupId}), (c:Competitor {id:$teamId})
           MERGE (g)-[:HAS_COMPETITOR]->(c)`,
          { groupId, teamId }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    addCompetitorToGroup: async (_, {
      groupId,
      competitorId,
      kind,
      displayName,
      shortName,
      avatarUrl,
      badgeUrl,
    }, { driver }) => {
      const session = driver.session();
      try {
        await upsertCompetitorSnapshot(session, {
          competitorId,
          kind,
          displayName,
          shortName,
          avatarUrl,
          badgeUrl,
        });
        await session.run(
          `MATCH (g:Group {id:$groupId}), (c:Competitor {id:$competitorId})
           MERGE (g)-[:HAS_COMPETITOR]->(c)`,
          { groupId, competitorId }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    upsertCompetitor: async (_, {
      competitorId,
      kind,
      displayName,
      shortName,
      avatarUrl,
      badgeUrl,
    }, { driver }) => {
      const session = driver.session();
      try {
        const competitor = await upsertCompetitorSnapshot(session, {
          competitorId,
          kind,
          displayName,
          shortName,
          avatarUrl,
          badgeUrl,
        });
        return {
          id: competitor.id,
          kind: competitor.kind,
          displayName: competitor.displayName,
          shortName: competitor.shortName ?? null,
          avatarUrl: competitor.avatarUrl ?? null,
          badgeUrl: competitor.badgeUrl ?? null,
          source: competitor.source ?? null,
          updatedAt: competitor.updatedAt ?? null,
        };
      } finally {
        await session.close();
      }
    },
    createMatch: async (_, { stageId, groupId, homeTeamId, awayTeamId, round, leg, scheduledAt }, { driver }) => {
      const id = genId('m');
      const session = driver.session();
      try {
        await upsertCompetitorSnapshot(session, {
          competitorId: homeTeamId,
          kind: 'team',
          displayName: `Equipo ${homeTeamId}`,
          shortName: null,
          avatarUrl: null,
          badgeUrl: null,
        });
        await upsertCompetitorSnapshot(session, {
          competitorId: awayTeamId,
          kind: 'team',
          displayName: `Equipo ${awayTeamId}`,
          shortName: null,
          avatarUrl: null,
          badgeUrl: null,
        });
        await session.run(
          `MATCH (s:Stage {id:$stageId})
           OPTIONAL MATCH (g:Group {id:$groupId})
           MATCH (home:Competitor {id:$homeTeamId})
           MATCH (away:Competitor {id:$awayTeamId})
           CREATE (m:Match {
             id:$id,
             round:$round,
             leg:$leg,
             scheduledAt:$scheduledAt,
             homeTeamId:$homeTeamId,
             awayTeamId:$awayTeamId
           })
           CREATE (s)-[:HAS_MATCH]->(m)
           FOREACH (_ IN CASE WHEN g IS NULL THEN [] ELSE [1] END | CREATE (g)-[:HAS_MATCH]->(m))
           CREATE (m)-[:HAS_COMPETITOR {role:'home'}]->(home)
           CREATE (m)-[:HAS_COMPETITOR {role:'away'}]->(away)
           RETURN m`,
          {
            stageId,
            groupId: groupId ?? null,
            id,
            round: round ?? null,
            leg: leg ?? null,
            scheduledAt: scheduledAt ?? null,
            homeTeamId,
            awayTeamId,
          }
        );
        return {
          id,
          round: round ?? null,
          leg: leg ?? null,
          scheduledAt: scheduledAt ?? null,
          homeTeamId,
          awayTeamId,
        };
      } finally {
        await session.close();
      }
    },
    addKey: async (_, { stageId, name, order }, { driver }) => {
      const id = genId('k');
      const session = driver.session();
      try {
        await session.run(
          `MATCH (s:Stage {id:$stageId})
           CREATE (s)-[:HAS_KEY {order:$order}]->(k:Key {id:$id, name:$name, order:$order})
           RETURN k`,
          { stageId, id, name, order }
        );
        return { id, name, order };
      } finally {
        await session.close();
      }
    },
    linkGroupToKey: async (_, { keyId, groupId }, { driver }) => {
      const session = driver.session();
      try {
        await session.run(
          `MATCH (k:Key {id:$keyId}), (g:Group {id:$groupId})
           MERGE (k)-[:HAS_GROUP]->(g)`,
          { keyId, groupId }
        );
        return true;
      } finally {
        await session.close();
      }
    },
  },
  Tournament: {
    competitions: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (t:Tournament {id:$id})- [hc:HAS_COMPETITION]->(c:Competition)
           RETURN c ORDER BY hc.order`,
          { id: parent.id }
        );
        return res.records.map(r => {
          const c = r.get('c').properties;
          return { id: c.id, name: c.name, order: Number(c.order) || 0 };
        });
      } finally {
        await session.close();
      }
    }
  },
  Competition: {
    stages: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (c:Competition {id:$id})- [hs:HAS_STAGE]->(s:Stage)
           RETURN s ORDER BY hs.order`,
          { id: parent.id }
        );
        return res.records.map(r => {
          const s = r.get('s').properties;
          return {
            id: s.id,
            name: s.name,
            order: Number(s.order) || 0,
            format: s.format,
            configJson: s.configJson ?? null,
            childrenJson: s.childrenJson ?? null,
          };
        });
      } finally {
        await session.close();
      }
    }
  },
  Stage: {
    transitions: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (s:Stage {id:$id})-[:EMITS|HAS_TRANSITION]->(tr:Transition)
           RETURN DISTINCT tr`,
          { id: parent.id }
        );
        return res.records.map((r) => {
          const t = r.get('tr').properties;
          return {
            id: t.id,
            type: t.type,
            label: t.label ?? null,
            selectionKind: t.selectionKind ?? null,
            topN: t.topN != null ? Number(t.topN) : null,
            rangeFrom: t.rangeFrom != null ? Number(t.rangeFrom) : null,
            rangeTo: t.rangeTo != null ? Number(t.rangeTo) : null,
            bottomN: t.bottomN != null ? Number(t.bottomN) : null,
            toExternalTournamentId: t.toExternalTournamentId ?? null,
            toExternalStageId: t.toExternalStageId ?? null,
            toExternalTournamentName: t.toExternalTournamentName ?? null,
            carryOverJson: t.carryOverJson ?? null,
          };
        });
      } finally {
        await session.close();
      }
    },
    groups: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (s:Stage {id:$id})-[hg:HAS_GROUP]->(g:Group)
           RETURN g ORDER BY hg.order`,
          { id: parent.id }
        );
        return res.records.map((r) => {
          const g = r.get('g').properties;
          return {
            id: g.id,
            name: g.name,
            order: Number(g.order) || 0,
          };
        });
      } finally {
        await session.close();
      }
    },
    keys: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (s:Stage {id:$id})-[hk:HAS_KEY]->(k:Key)
           RETURN k ORDER BY hk.order`,
          { id: parent.id }
        );
        return res.records.map((r) => {
          const k = r.get('k').properties;
          return {
            id: k.id,
            name: k.name,
            order: Number(k.order) || 0,
          };
        });
      } finally {
        await session.close();
      }
    },
    matches: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (s:Stage {id:$id})-[:HAS_MATCH]->(m:Match)
           RETURN m ORDER BY m.round, m.leg, m.id`,
          { id: parent.id }
        );
        return res.records.map((r) => {
          const m = r.get('m').properties;
          return {
            id: m.id,
            round: m.round != null ? Number(m.round) : null,
            leg: m.leg != null ? Number(m.leg) : null,
            scheduledAt: m.scheduledAt ?? null,
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
          };
        });
      } finally {
        await session.close();
      }
    },
  },
  Group: {
    competitorIds: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (g:Group {id:$id})-[:HAS_COMPETITOR]->(c:Competitor)
           RETURN c.id AS cid ORDER BY c.id`,
          { id: parent.id }
        );
        return res.records.map((r) => r.get('cid'));
      } finally {
        await session.close();
      }
    },
    competitors: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (g:Group {id:$id})-[:HAS_COMPETITOR]->(c:Competitor)
           RETURN c ORDER BY c.displayName, c.id`,
          { id: parent.id }
        );
        return res.records.map((r) => {
          const c = r.get('c').properties;
          return {
            id: c.id,
            kind: c.kind ?? 'team',
            displayName: c.displayName ?? c.id,
            shortName: c.shortName ?? null,
            avatarUrl: c.avatarUrl ?? null,
            badgeUrl: c.badgeUrl ?? null,
            source: c.source ?? null,
            updatedAt: c.updatedAt ?? null,
          };
        });
      } finally {
        await session.close();
      }
    },
  },
  Match: {
    homeCompetitor: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (m:Match {id:$id})-[:HAS_COMPETITOR {role:'home'}]->(c:Competitor)
           RETURN c LIMIT 1`,
          { id: parent.id }
        );
        if (res.records.length === 0) return null;
        const c = res.records[0].get('c').properties;
        return {
          id: c.id,
          kind: c.kind ?? 'team',
          displayName: c.displayName ?? c.id,
          shortName: c.shortName ?? null,
          avatarUrl: c.avatarUrl ?? null,
          badgeUrl: c.badgeUrl ?? null,
          source: c.source ?? null,
          updatedAt: c.updatedAt ?? null,
        };
      } finally {
        await session.close();
      }
    },
    awayCompetitor: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (m:Match {id:$id})-[:HAS_COMPETITOR {role:'away'}]->(c:Competitor)
           RETURN c LIMIT 1`,
          { id: parent.id }
        );
        if (res.records.length === 0) return null;
        const c = res.records[0].get('c').properties;
        return {
          id: c.id,
          kind: c.kind ?? 'team',
          displayName: c.displayName ?? c.id,
          shortName: c.shortName ?? null,
          avatarUrl: c.avatarUrl ?? null,
          badgeUrl: c.badgeUrl ?? null,
          source: c.source ?? null,
          updatedAt: c.updatedAt ?? null,
        };
      } finally {
        await session.close();
      }
    },
  },
  Key: {
    groupIds: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (k:Key {id:$id})-[:HAS_GROUP]->(g:Group)
           RETURN g.id AS gid ORDER BY g.id`,
          { id: parent.id }
        );
        return res.records.map((r) => r.get('gid'));
      } finally {
        await session.close();
      }
    },
  }
};

async function waitForNeo4jConnection(driver, maxAttempts = 20, delayMs = 500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await driver.getServerInfo();
      return;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function bootstrap() {
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD));
  await waitForNeo4jConnection(driver);

  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Health endpoint
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const schema = buildSubgraphSchema({ typeDefs, resolvers });
  const server = new ApolloServer({ schema });
  await server.start();

  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => ({
      driver,
      headers: {
        authorization: req.headers.authorization || '',
      },
    }),
  }));

  app.listen(PORT, () => {
    console.log(`[tournaments-svc] running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[tournaments-svc] fatal error:', err);
  process.exit(1);
});



