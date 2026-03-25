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

function parseJsonSafe(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function deriveCompetitionCapacityFromStage(stageProps) {
  const format = String(stageProps?.format || '').toLowerCase();
  const cfg = parseJsonSafe(stageProps?.configJson) || {};
  if (format === 'league' || format === 'elimination') {
    const participants = Number(cfg.numParticipants);
    if (Number.isInteger(participants) && participants > 0) return participants;
  }
  if (format === 'groups') {
    const groups = Number(cfg.numGroups);
    const perGroup = Number(cfg.teamsPerGroup);
    if (Number.isInteger(groups) && groups > 0 && Number.isInteger(perGroup) && perGroup > 0) {
      return groups * perGroup;
    }
  }
  return null;
}

function deriveStageCapacity(stageProps) {
  const format = String(stageProps?.format || '').toLowerCase();
  const cfg = parseJsonSafe(stageProps?.configJson) || {};
  if (format === 'league' || format === 'elimination') {
    const numParticipants = Number(cfg.numParticipants);
    if (Number.isInteger(numParticipants) && numParticipants > 0) return numParticipants;
  }
  if (format === 'groups') {
    const numGroups = Number(cfg.numGroups);
    const teamsPerGroup = Number(cfg.teamsPerGroup);
    if (Number.isInteger(numGroups) && numGroups > 0 && Number.isInteger(teamsPerGroup) && teamsPerGroup > 0) {
      return numGroups * teamsPerGroup;
    }
  }
  return null;
}

function deriveGroupsConfig(stageProps) {
  const cfg = parseJsonSafe(stageProps?.configJson) || {};
  const numGroups = Number(cfg.numGroups);
  const teamsPerGroup = Number(cfg.teamsPerGroup);
  return {
    numGroups: Number.isInteger(numGroups) && numGroups > 0 ? numGroups : 0,
    teamsPerGroup: Number.isInteger(teamsPerGroup) && teamsPerGroup > 0 ? teamsPerGroup : 0,
  };
}

async function resolveCompetitionEffectiveMaxSlots(session, competitionId) {
  const compR = await session.run(
    `MATCH (c:Competition {id:$id})
     RETURN c
     LIMIT 1`,
    { id: competitionId }
  );
  if (compR.records.length === 0) throw new Error('NOT_FOUND: competition no existe');
  const competition = compR.records[0].get('c').properties;
  const explicit = Number(competition.maxSlots);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;

  const stagesR = await session.run(
    `MATCH (c:Competition {id:$id})-[hs:HAS_STAGE]->(s:Stage)
     RETURN s
     ORDER BY hs.order`,
    { id: competitionId }
  );
  for (const record of stagesR.records) {
    const capacity = deriveCompetitionCapacityFromStage(record.get('s').properties);
    if (capacity && capacity > 0) return capacity;
  }
  return 16;
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
            maxSlots: Number(t.maxSlots) || 16,
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
          maxSlots: Number(t.maxSlots) || 16,
          inscriptionMode: t.inscriptionMode ?? 'public',
          status: t.status ?? 'draft',
        };
      } finally {
        await session.close();
      }
    },
    competition: async (_,{ id },{ driver }) => {
      const session = driver.session();
      try {
        const r = await session.run(
          `MATCH (c:Competition {id:$id})
           RETURN c
           LIMIT 1`,
          { id }
        );
        if (r.records.length === 0) return null;
        const c = r.records[0].get('c').properties;
        const effective = await resolveCompetitionEffectiveMaxSlots(session, id);
        return {
          id: c.id,
          name: c.name,
          order: Number(c.order) || 0,
          maxSlots: c.maxSlots != null ? Number(c.maxSlots) : null,
          effectiveMaxSlots: effective,
        };
      } finally {
        await session.close();
      }
    },
  },
  Mutation: {
    createTournament: async (_, { name, sport, season, venue, participantType, maxSlots, inscriptionMode, status }, context) => {
      const user = requireOrganizer(context);
      const organizer = String(user?.username || '').trim() || `organizer-${String(user?.sub || '')}`;
      const parsedMaxSlots = Number(maxSlots ?? 0);
      const safeMaxSlots = Number.isInteger(parsedMaxSlots) && parsedMaxSlots > 0 ? parsedMaxSlots : 16;
      const id = genId('t');
      const session = context.driver.session();
      try {
        await session.run(
          'CREATE (t:Tournament {id:$id, name:$name, sport:$sport, season:$season, venue:$venue, organizer:$organizer, participantType:$pt, maxSlots:$maxSlots, inscriptionMode:$inscriptionMode, status:$status}) RETURN t',
          {
            id,
            name,
            sport,
            season: season || null,
            venue: venue || null,
            organizer,
            pt: participantType || null,
            maxSlots: safeMaxSlots,
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
          organizer,
          participantType: participantType || null,
          maxSlots: safeMaxSlots,
          inscriptionMode,
          status,
        };
      } finally {
        await session.close();
      }
    },
    updateTournament: async (
      _,
      { id, name, sport, season, venue, participantType, inscriptionMode, status },
      context
    ) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const updated = await session.run(
          `MATCH (t:Tournament {id:$id})
           SET t.name = $name,
               t.sport = $sport,
               t.season = $season,
               t.venue = $venue,
               t.participantType = $participantType,
               t.inscriptionMode = $inscriptionMode,
               t.status = $status
           RETURN t
           LIMIT 1`,
          {
            id,
            name,
            sport,
            season: season || null,
            venue: venue || null,
            participantType: participantType || null,
            inscriptionMode,
            status,
          }
        );
        if (updated.records.length === 0) throw new Error('NOT_FOUND: tournament no existe');
        const t = updated.records[0].get('t').properties;
        return {
          id: t.id,
          name: t.name,
          sport: t.sport ?? 'football',
          season: t.season ?? null,
          venue: t.venue ?? null,
          organizer: t.organizer ?? null,
          participantType: t.participantType ?? null,
          maxSlots: Number(t.maxSlots) || 16,
          inscriptionMode: t.inscriptionMode ?? 'public',
          status: t.status ?? 'draft',
        };
      } finally {
        await session.close();
      }
    },
    deleteTournament: async (_, { id }, context) => {
      const user = requireOrganizer(context);
      const session = context.driver.session();
      try {
        const found = await session.run(
          `MATCH (t:Tournament {id:$id})
           RETURN t
           LIMIT 1`,
          { id }
        );
        if (found.records.length === 0) return false;
        const tournament = found.records[0].get('t').properties;
        const owner = String(tournament.organizer || '').trim().toLowerCase();
        const requester = String(user?.username || '').trim().toLowerCase();
        if (!owner || !requester || owner !== requester) {
          throw new Error('FORBIDDEN: solo el organizador creador puede eliminar este torneo');
        }
        await session.run(
          `MATCH (t:Tournament {id:$id})
           DETACH DELETE t`,
          { id }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    // Persistencia mínima de Competition y relación con Tournament
    createCompetition: async (_, { tournamentId, name, order, maxSlots }, { driver }) => {
      const id = genId('c');
      const session = driver.session();
      try {
        const parsed = maxSlots == null ? null : Number(maxSlots);
        const safeMaxSlots = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        await session.run(
          `MATCH (t:Tournament {id:$tid})
           CREATE (t)-[:HAS_COMPETITION {order:$order}]->(c:Competition {id:$id, name:$name, order:$order, maxSlots:$maxSlots})
           RETURN c`,
          { tid: tournamentId, id, name, order, maxSlots: safeMaxSlots }
        );
        const effective = safeMaxSlots ?? 16;
        return { id, name, order, maxSlots: safeMaxSlots, effectiveMaxSlots: effective };
      } finally {
        await session.close();
      }
    },
    updateCompetition: async (_, { competitionId, name, order, maxSlots }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const parsed = maxSlots == null ? null : Number(maxSlots);
        const safeMaxSlots = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        const updated = await session.run(
          `MATCH (c:Competition {id:$id})
           SET c.name = $name,
               c.order = $order,
               c.maxSlots = $maxSlots
           RETURN c
           LIMIT 1`,
          { id: competitionId, name, order, maxSlots: safeMaxSlots }
        );
        if (updated.records.length === 0) throw new Error('NOT_FOUND: competition no existe');
        const c = updated.records[0].get('c').properties;
        const effective = await resolveCompetitionEffectiveMaxSlots(session, competitionId);
        return {
          id: c.id,
          name: c.name,
          order: Number(c.order) || 0,
          maxSlots: c.maxSlots != null ? Number(c.maxSlots) : null,
          effectiveMaxSlots: effective,
        };
      } finally {
        await session.close();
      }
    },
    updateCompetitionMaxSlots: async (_, { competitionId, maxSlots }, { driver }) => {
      const session = driver.session();
      try {
        const parsed = maxSlots == null ? null : Number(maxSlots);
        if (parsed != null && (!Number.isInteger(parsed) || parsed <= 0)) {
          throw new Error('BAD_REQUEST: maxSlots debe ser entero positivo o null');
        }
        const updated = await session.run(
          `MATCH (c:Competition {id:$id})
           SET c.maxSlots = $maxSlots
           RETURN c
           LIMIT 1`,
          { id: competitionId, maxSlots: parsed }
        );
        if (updated.records.length === 0) throw new Error('NOT_FOUND: competition no existe');
        const c = updated.records[0].get('c').properties;
        const effective = await resolveCompetitionEffectiveMaxSlots(session, competitionId);
        return {
          id: c.id,
          name: c.name,
          order: Number(c.order) || 0,
          maxSlots: c.maxSlots != null ? Number(c.maxSlots) : null,
          effectiveMaxSlots: effective,
        };
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
    updateStage: async (_, { stageId, name, order, format, configJson, childrenJson }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const updated = await session.run(
          `MATCH (st:Stage {id:$id})
           SET st.name = $name,
               st.order = $order,
               st.format = $format,
               st.configJson = $configJson,
               st.childrenJson = $childrenJson
           RETURN st
           LIMIT 1`,
          {
            id: stageId,
            name,
            order,
            format,
            configJson: configJson ?? null,
            childrenJson: childrenJson ?? null,
          }
        );
        if (updated.records.length === 0) throw new Error('NOT_FOUND: stage no existe');
        const st = updated.records[0].get('st').properties;
        return {
          id: st.id,
          name: st.name,
          order: Number(st.order) || 0,
          format: st.format,
          configJson: st.configJson ?? null,
          childrenJson: st.childrenJson ?? null,
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
    syncStageGroups: async (_, { stageId, totalGroups }, context) => {
      requireOrganizer(context);
      const safeTotalGroups = Number(totalGroups);
      if (!Number.isInteger(safeTotalGroups) || safeTotalGroups <= 0) {
        throw new Error('BAD_REQUEST: totalGroups debe ser entero positivo');
      }
      const session = context.driver.session();
      try {
        const check = await session.run(
          `MATCH (s:Stage {id:$stageId})
           RETURN s
           LIMIT 1`,
          { stageId }
        );
        if (check.records.length === 0) throw new Error('NOT_FOUND: stage no existe');

        const existing = await session.run(
          `MATCH (s:Stage {id:$stageId})-[r:HAS_GROUP]->(g:Group)
           RETURN g
           ORDER BY r.order`,
          { stageId }
        );
        const existingGroups = existing.records.map((record) => record.get('g').properties);
        if (existingGroups.length > safeTotalGroups) {
          throw new Error('BAD_REQUEST: no se puede reducir grupos cuando ya existen más grupos persistidos');
        }

        for (let i = existingGroups.length; i < safeTotalGroups; i++) {
          const groupId = genId('g');
          const order = i + 1;
          await session.run(
            `MATCH (s:Stage {id:$stageId})
             CREATE (s)-[:HAS_GROUP {order:$order}]->(g:Group {id:$id, name:$name, order:$order})
             RETURN g`,
            {
              stageId,
              id: groupId,
              name: `Grupo ${order}`,
              order,
            }
          );
        }

        const listed = await session.run(
          `MATCH (s:Stage {id:$stageId})-[r:HAS_GROUP]->(g:Group)
           RETURN g
           ORDER BY r.order`,
          { stageId }
        );
        return listed.records.map((record) => {
          const g = record.get('g').properties;
          return { id: g.id, name: g.name, order: Number(g.order) || 0 };
        });
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
    assignInscriptionToGroup: async (_, { stageId, groupId, inscriptionId, tournamentId, displayName }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const stageR = await session.run(
          `MATCH (s:Stage {id:$stageId})
           RETURN s
           LIMIT 1`,
          { stageId }
        );
        if (stageR.records.length === 0) throw new Error('NOT_FOUND: stage no existe');
        const stageProps = stageR.records[0].get('s').properties;
        const format = String(stageProps?.format || '').toLowerCase();
        if (format !== 'groups') throw new Error('BAD_REQUEST: la etapa no es de grupos');

        const groupR = await session.run(
          `MATCH (s:Stage {id:$stageId})-[:HAS_GROUP]->(g:Group {id:$groupId})
           RETURN g
           LIMIT 1`,
          { stageId, groupId }
        );
        if (groupR.records.length === 0) throw new Error('BAD_REQUEST: grupo no pertenece a la etapa');

        const { teamsPerGroup } = deriveGroupsConfig(stageProps);
        if (teamsPerGroup > 0) {
          const countR = await session.run(
            `MATCH (:Group {id:$groupId})-[:HAS_ASSIGNED_INSCRIPTION]->(:InscriptionRef)
             RETURN COUNT(*) AS count`,
            { groupId }
          );
          const count = Number(countR.records[0]?.get('count') || 0);
          if (count >= teamsPerGroup) throw new Error('GROUP_CAPACITY_REACHED');
        }

        const stageCap = deriveStageCapacity(stageProps);
        if (stageCap && stageCap > 0) {
          const stageCountR = await session.run(
            `MATCH (:Stage {id:$stageId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid})
             RETURN COUNT(DISTINCT i.inscriptionId) AS count`,
            { stageId, tid: tournamentId }
          );
          const stageCount = Number(stageCountR.records[0]?.get('count') || 0);
          const existsInStageR = await session.run(
            `MATCH (:Stage {id:$stageId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
             RETURN i LIMIT 1`,
            { stageId, tid: tournamentId, iid: inscriptionId }
          );
          const alreadyInStage = existsInStageR.records.length > 0;
          if (!alreadyInStage && stageCount >= stageCap) throw new Error('STAGE_CAPACITY_REACHED');
        }

        await session.run(
          `MATCH (s:Stage {id:$stageId}), (g:Group {id:$groupId})
           MERGE (i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           SET i.displayName = $displayName
           MERGE (s)-[:HAS_ASSIGNED_INSCRIPTION]->(i)
           MERGE (g)-[:HAS_ASSIGNED_INSCRIPTION]->(i)
           WITH s, i
           OPTIONAL MATCH (s)-[:HAS_GROUP]->(other:Group)-[r:HAS_ASSIGNED_INSCRIPTION]->(i)
           WHERE other.id <> $groupId
           DELETE r`,
          {
            stageId,
            groupId,
            tid: tournamentId,
            iid: inscriptionId,
            displayName,
          }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    unassignInscriptionFromGroup: async (_, { groupId, inscriptionId, tournamentId }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        await session.run(
          `MATCH (:Group {id:$groupId})-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           DELETE r`,
          { groupId, tid: tournamentId, iid: inscriptionId }
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
    ensureEliminationBracket: async (_, { stageId, totalSlots }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      const safeTotalSlots = Number(totalSlots);
      if (!Number.isInteger(safeTotalSlots) || safeTotalSlots <= 1) {
        throw new Error('BAD_REQUEST: totalSlots debe ser entero mayor a 1');
      }
      try {
        const stageR = await session.run(
          `MATCH (s:Stage {id:$stageId})
           RETURN s
           LIMIT 1`,
          { stageId }
        );
        if (stageR.records.length === 0) throw new Error('NOT_FOUND: stage no existe');
        const stageProps = stageR.records[0].get('s').properties;
        if (String(stageProps?.format || '').toLowerCase() !== 'elimination') {
          throw new Error('BAD_REQUEST: la etapa no es de eliminación');
        }

        const existingR = await session.run(
          `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           RETURN COUNT(m) AS count`,
          { stageId }
        );
        const existingCount = Number(existingR.records[0]?.get('count') || 0);
        const requiredMatches = Math.ceil(safeTotalSlots / 2);
        for (let i = existingCount; i < requiredMatches; i++) {
          await session.run(
            `MATCH (s:Stage {id:$stageId})
             CREATE (m:Match {
               id:$id,
               round:1,
               leg:1,
               slotIndex:$slotIndex,
               homeInscriptionId:null,
               awayInscriptionId:null,
               homeDisplayName:null,
               awayDisplayName:null,
               homeTournamentId:null,
               awayTournamentId:null
             })
             CREATE (s)-[:HAS_MATCH]->(m)`,
            { stageId, id: genId('m'), slotIndex: i + 1 }
          );
        }

        const listed = await session.run(
          `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           RETURN m
           ORDER BY COALESCE(m.round, 1), COALESCE(m.slotIndex, 999), m.id`,
          { stageId }
        );
        return listed.records.map((record) => {
          const m = record.get('m').properties;
          return {
            id: m.id,
            round: m.round != null ? Number(m.round) : null,
            leg: m.leg != null ? Number(m.leg) : null,
            scheduledAt: m.scheduledAt ?? null,
            homeTeamId: m.homeTeamId ?? m.homeInscriptionId ?? '',
            awayTeamId: m.awayTeamId ?? m.awayInscriptionId ?? '',
          };
        });
      } finally {
        await session.close();
      }
    },
    assignInscriptionToMatchSlot: async (
      _,
      { stageId, matchId, slotRole, inscriptionId, tournamentId, displayName },
      context
    ) => {
      requireOrganizer(context);
      const role = String(slotRole || '').toLowerCase();
      if (!['home', 'away'].includes(role)) throw new Error('BAD_REQUEST: slotRole inválido');
      const session = context.driver.session();
      try {
        const stageR = await session.run(
          `MATCH (s:Stage {id:$stageId})
           RETURN s
           LIMIT 1`,
          { stageId }
        );
        if (stageR.records.length === 0) throw new Error('NOT_FOUND: stage no existe');
        const stageProps = stageR.records[0].get('s').properties;
        if (String(stageProps?.format || '').toLowerCase() !== 'elimination') {
          throw new Error('BAD_REQUEST: la etapa no es de eliminación');
        }
        const stageCap = deriveStageCapacity(stageProps);

        const matchR = await session.run(
          `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match {id:$matchId})
           RETURN m
           LIMIT 1`,
          { stageId, matchId }
        );
        if (matchR.records.length === 0) throw new Error('BAD_REQUEST: match no pertenece a la etapa');

        if (!inscriptionId) {
          const clearField = role === 'home'
            ? `m.homeInscriptionId = null, m.homeDisplayName = null, m.homeTournamentId = null`
            : `m.awayInscriptionId = null, m.awayDisplayName = null, m.awayTournamentId = null`;
          await session.run(
            `MATCH (m:Match {id:$matchId})
             SET ${clearField}`,
            { matchId }
          );
          return true;
        }

        const duplicateR = await session.run(
          `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           WHERE m.homeInscriptionId = $iid OR m.awayInscriptionId = $iid
           RETURN m
           LIMIT 1`,
          { stageId, iid: inscriptionId }
        );
        const alreadyInAnother = duplicateR.records.some((record) => String(record.get('m').properties.id) !== String(matchId));
        if (alreadyInAnother) throw new Error('BAD_REQUEST: la inscripción ya está ubicada en otra llave');
        const currentMatch = matchR.records[0].get('m').properties;
        if (
          (role === 'home' && String(currentMatch.awayInscriptionId || '') === String(inscriptionId)) ||
          (role === 'away' && String(currentMatch.homeInscriptionId || '') === String(inscriptionId))
        ) {
          throw new Error('BAD_REQUEST: la inscripción no puede ocupar ambos lados de la misma llave');
        }

        if (stageCap && stageCap > 0) {
          const stageCountR = await session.run(
            `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
             WITH COLLECT(DISTINCT m.homeInscriptionId) + COLLECT(DISTINCT m.awayInscriptionId) AS ids
             UNWIND ids AS raw
             WITH raw WHERE raw IS NOT NULL AND raw <> ''
             RETURN COUNT(DISTINCT raw) AS count`,
            { stageId }
          );
          const stageCount = Number(stageCountR.records[0]?.get('count') || 0);
          const existsAlready = duplicateR.records.length > 0;
          if (!existsAlready && stageCount >= stageCap) throw new Error('STAGE_CAPACITY_REACHED');
        }

        const setField = role === 'home'
          ? `m.homeInscriptionId = $iid, m.homeDisplayName = $displayName, m.homeTournamentId = $tid`
          : `m.awayInscriptionId = $iid, m.awayDisplayName = $displayName, m.awayTournamentId = $tid`;
        await session.run(
          `MATCH (m:Match {id:$matchId})
           SET ${setField}`,
          { matchId, iid: inscriptionId, displayName: displayName || null, tid: tournamentId }
        );
        await session.run(
          `MATCH (s:Stage {id:$stageId})
           MERGE (i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           SET i.displayName = $displayName
           MERGE (s)-[:HAS_ASSIGNED_INSCRIPTION]->(i)`,
          { stageId, tid: tournamentId, iid: inscriptionId, displayName: displayName || inscriptionId }
        );
        return true;
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
    assignInscriptionToStage: async (_, { stageId, inscriptionId, tournamentId, displayName }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const stageCheck = await session.run(
          `MATCH (t:Tournament {id:$tid})-[:HAS_COMPETITION]->(:Competition)-[:HAS_STAGE]->(s:Stage {id:$stageId})
           RETURN s LIMIT 1`,
          { tid: tournamentId, stageId }
        );
        if (stageCheck.records.length === 0) {
          throw new Error('BAD_REQUEST: stage no pertenece al torneo');
        }
        const initialCheck = await session.run(
          `MATCH (c:Competition)-[:HAS_STAGE]->(s:Stage {id:$stageId})
           OPTIONAL MATCH (c)-[:HAS_STAGE]->(other:Stage)-[:ADVANCES_TO]->(s)
           RETURN COUNT(other) AS incoming`,
          { stageId }
        );
        const incoming = Number(initialCheck.records[0]?.get('incoming') || 0);
        if (incoming > 0) {
          throw new Error('BAD_REQUEST: solo se puede asignar a una fase inicial');
        }
        const stageProps = stageCheck.records[0].get('s').properties;
        const stageCapacity = deriveStageCapacity(stageProps);
        if (stageCapacity && stageCapacity > 0) {
          const totalR = await session.run(
            `MATCH (s:Stage {id:$stageId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid})
             RETURN COUNT(DISTINCT i.inscriptionId) AS count`,
            { stageId, tid: tournamentId }
          );
          const totalCount = Number(totalR.records[0]?.get('count') || 0);
          const existsR = await session.run(
            `MATCH (:Stage {id:$stageId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
             RETURN i LIMIT 1`,
            { stageId, tid: tournamentId, iid: inscriptionId }
          );
          if (existsR.records.length === 0 && totalCount >= stageCapacity) {
            throw new Error('STAGE_CAPACITY_REACHED');
          }
        }
        await session.run(
          `MATCH (s:Stage {id:$stageId})
           MERGE (i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           SET i.displayName = $displayName
           MERGE (s)-[:HAS_ASSIGNED_INSCRIPTION]->(i)`,
          { stageId, tid: tournamentId, iid: inscriptionId, displayName }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    unassignInscriptionFromStage: async (_, { stageId, inscriptionId, tournamentId }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        await session.run(
          `MATCH (:Stage {id:$stageId})-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           DELETE r`,
          { stageId, tid: tournamentId, iid: inscriptionId }
        );
        await session.run(
          `MATCH (:Stage {id:$stageId})-[:HAS_GROUP]->(:Group)-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           DELETE r`,
          { stageId, tid: tournamentId, iid: inscriptionId }
        );
        await session.run(
          `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           WHERE m.homeTournamentId = $tid AND m.homeInscriptionId = $iid
           SET m.homeTournamentId = null, m.homeInscriptionId = null, m.homeDisplayName = null`,
          { stageId, tid: tournamentId, iid: inscriptionId }
        );
        await session.run(
          `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           WHERE m.awayTournamentId = $tid AND m.awayInscriptionId = $iid
           SET m.awayTournamentId = null, m.awayInscriptionId = null, m.awayDisplayName = null`,
          { stageId, tid: tournamentId, iid: inscriptionId }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    clearInscriptionAssignments: async (_, { inscriptionId, tournamentId }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        await session.run(
          `MATCH (t:Tournament {id:$tid})-[:HAS_COMPETITION]->(:Competition)-[:HAS_STAGE]->(s:Stage)
           OPTIONAL MATCH (s)-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           DELETE r`,
          { tid: tournamentId, iid: inscriptionId }
        );
        await session.run(
          `MATCH (:Group)-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           DELETE r`,
          { tid: tournamentId, iid: inscriptionId }
        );
        await session.run(
          `MATCH (m:Match)
           WHERE m.homeTournamentId = $tid AND m.homeInscriptionId = $iid
           SET m.homeTournamentId = null, m.homeInscriptionId = null, m.homeDisplayName = null`,
          { tid: tournamentId, iid: inscriptionId }
        );
        await session.run(
          `MATCH (m:Match)
           WHERE m.awayTournamentId = $tid AND m.awayInscriptionId = $iid
           SET m.awayTournamentId = null, m.awayInscriptionId = null, m.awayDisplayName = null`,
          { tid: tournamentId, iid: inscriptionId }
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
    maxSlots: (parent) => (parent.maxSlots != null ? Number(parent.maxSlots) : null),
    effectiveMaxSlots: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        return await resolveCompetitionEffectiveMaxSlots(session, parent.id);
      } finally {
        await session.close();
      }
    },
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
    isInitial: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (c:Competition)-[:HAS_STAGE]->(s:Stage {id:$id})
           OPTIONAL MATCH (c)-[:HAS_STAGE]->(other:Stage)-[:ADVANCES_TO]->(s)
           RETURN COUNT(other) AS incoming`,
          { id: parent.id }
        );
        const incoming = Number(res.records[0]?.get('incoming') || 0);
        return incoming === 0;
      } finally {
        await session.close();
      }
    },
    assignedInscriptions: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (s:Stage {id:$id})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
           RETURN i ORDER BY i.displayName, i.inscriptionId`,
          { id: parent.id }
        );
        return res.records.map((r) => {
          const i = r.get('i').properties;
          return {
            inscriptionId: i.inscriptionId,
            tournamentId: i.tournamentId,
            displayName: i.displayName ?? i.inscriptionId,
          };
        });
      } finally {
        await session.close();
      }
    },
    transitions: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (s:Stage {id:$id})-[:EMITS|HAS_TRANSITION]->(tr:Transition)
           OPTIONAL MATCH (tr)-[:TO_STAGE]->(dst:Stage)
           RETURN DISTINCT tr, dst`,
          { id: parent.id }
        );
        return res.records.map((r) => {
          const t = r.get('tr').properties;
          const dst = r.get('dst')?.properties || null;
          return {
            id: t.id,
            type: t.type,
            label: t.label ?? null,
            toStageId: dst?.id ?? null,
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
            slotIndex: m.slotIndex != null ? Number(m.slotIndex) : null,
            homeTeamId: m.homeTeamId ?? m.homeInscriptionId ?? '',
            awayTeamId: m.awayTeamId ?? m.awayInscriptionId ?? '',
            homeInscriptionId: m.homeInscriptionId ?? null,
            awayInscriptionId: m.awayInscriptionId ?? null,
            homeDisplayName: m.homeDisplayName ?? null,
            awayDisplayName: m.awayDisplayName ?? null,
            homeTournamentId: m.homeTournamentId ?? null,
            awayTournamentId: m.awayTournamentId ?? null,
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
    assignedInscriptions: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (g:Group {id:$id})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
           RETURN i
           ORDER BY i.displayName, i.inscriptionId`,
          { id: parent.id }
        );
        return res.records.map((record) => {
          const i = record.get('i').properties;
          return {
            inscriptionId: i.inscriptionId,
            tournamentId: i.tournamentId,
            displayName: i.displayName ?? i.inscriptionId,
          };
        });
      } finally {
        await session.close();
      }
    },
    capacity: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (:Stage)-[:HAS_GROUP]->(g:Group {id:$id})
           RETURN g LIMIT 1`,
          { id: parent.id }
        );
        if (res.records.length === 0) return null;
        const group = res.records[0].get('g').properties;
        if (group.capacity != null) return Number(group.capacity);

        const cfgR = await session.run(
          `MATCH (:Stage)-[:HAS_GROUP]->(g:Group {id:$id})<-[:HAS_GROUP]-(s:Stage)
           RETURN s
           LIMIT 1`,
          { id: parent.id }
        );
        if (cfgR.records.length === 0) return null;
        const stageProps = cfgR.records[0].get('s').properties;
        const { teamsPerGroup } = deriveGroupsConfig(stageProps);
        return teamsPerGroup > 0 ? teamsPerGroup : null;
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
    homeAssignedInscription: (parent) => {
      if (!parent.homeInscriptionId) return null;
      return {
        inscriptionId: String(parent.homeInscriptionId),
        tournamentId: parent.homeTournamentId ?? '',
        displayName: parent.homeDisplayName ?? String(parent.homeInscriptionId),
      };
    },
    awayAssignedInscription: (parent) => {
      if (!parent.awayInscriptionId) return null;
      return {
        inscriptionId: String(parent.awayInscriptionId),
        tournamentId: parent.awayTournamentId ?? '',
        displayName: parent.awayDisplayName ?? String(parent.awayInscriptionId),
      };
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



