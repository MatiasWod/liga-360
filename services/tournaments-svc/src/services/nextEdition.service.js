/** Orquesta creación de próxima edición: clonar estructura + aplicar snapshots y permanencias. */
import { genId } from '../domain/shared/ids.js';
import {
  collectOutgoingSnapshotInscriptionIds,
  computePermanencyInscriptions,
  dedupeRowsByTeam,
  isNextEditionTransitionRow,
  parsePlacementSnapshot,
  resolveDestinationStageId,
} from '../domain/edition/nextEdition.domain.js';
import * as inscriptionsClient from '../clients/inscriptions.client.js';
import * as tournamentRepo from '../repositories/tournament.repository.js';
import * as seriesService from './competition-series.service.js';
import * as editionCloneService from './editionClone.service.js';
import * as stageService from './stage.service.js';

function conflict(message) {
  const err = new Error(message);
  err.code = 'CONFLICT';
  throw err;
}

function notFound(message) {
  const err = new Error(message);
  err.code = 'NOT_FOUND';
  throw err;
}

function badRequest(message) {
  const err = new Error(message);
  err.code = 'BAD_REQUEST';
  throw err;
}

function rethrowDomain(err) {
  if (err.code === 'CONFLICT') {
    throw Object.assign(new Error(err.message), { extensions: { code: 'CONFLICT' } });
  }
  if (err.code === 'NOT_FOUND') {
    throw Object.assign(new Error(err.message), { extensions: { code: 'NOT_FOUND' } });
  }
  if (err.code === 'BAD_REQUEST') {
    throw Object.assign(new Error(err.message), { extensions: { code: 'BAD_REQUEST' } });
  }
  throw err;
}

function acceptedTeamInscriptions(rows) {
  return (rows || []).filter(
    (r) =>
      String(r.status || '').toUpperCase() === 'ACEPTADO' &&
      String(r.competitor_kind || 'team').toLowerCase() === 'team'
  );
}

function buildCompetitionStages(structure) {
  const byComp = new Map();
  for (const stage of structure.stages) {
    const list = byComp.get(stage.competitionId) || [];
    list.push(stage.id);
    byComp.set(stage.competitionId, list);
  }
  return byComp;
}

async function rollbackTournament(driver, tournamentId) {
  if (!tournamentId) return;
  const session = driver.session();
  try {
    await tournamentRepo.cascadeDelete(session, tournamentId);
  } finally {
    await session.close();
  }
}

export async function createNextEditionFromTournament(
  driver,
  { sourceTournamentId, editionLabel, name, mode, seriesId, organizer, authHeader }
) {
  const warnings = [];
  let newTournamentId = null;
  const normalizedMode = String(mode || 'full').trim().toLowerCase() === 'structure_only' ? 'structure_only' : 'full';

  try {
    const session = driver.session();
    let source;
    try {
      source = await tournamentRepo.findRawById(session, sourceTournamentId);
    } finally {
      await session.close();
    }
    if (!source) notFound('NOT_FOUND: torneo fuente no existe');

    if (normalizedMode === 'full' && String(source.status || '').toLowerCase() !== 'finished') {
      badRequest('BAD_REQUEST: el torneo fuente debe estar finalizado (modo full)');
    }

    const owner = String(source.organizer || '').trim().toLowerCase();
    const requester = String(organizer || '').trim().toLowerCase();
    if (!owner || !requester || owner !== requester) {
      throw new Error('FORBIDDEN: solo el organizador creador puede crear la próxima edición');
    }

    let targetSeriesId = seriesId || null;
    if (!targetSeriesId) {
      const linked = await seriesService.getSeriesForTournament(driver, sourceTournamentId);
      targetSeriesId = linked?.id ?? null;
    }
    if (!targetSeriesId) {
      badRequest('BAD_REQUEST: el torneo debe pertenecer a una serie (seriesId requerido)');
    }

    const newId = genId('t');
    newTournamentId = newId;
    const createSession = driver.session();
    try {
      await tournamentRepo.create(createSession, {
        id: newId,
        name: String(name || source.name || '').trim() || source.name,
        sport: source.sport ?? 'football',
        season: source.season ?? null,
        venue: source.venue ?? null,
        organizer: source.organizer,
        participantType: source.participantType ?? null,
        maxSlots: Number(source.maxSlots) || 16,
        inscriptionMode: source.inscriptionMode ?? 'public',
        status: 'draft',
      });
    } finally {
      await createSession.close();
    }

    try {
      await seriesService.assignTournamentToSeries(driver, {
        tournamentId: newId,
        seriesId: targetSeriesId,
        editionLabel,
      });
    } catch (err) {
      rethrowDomain(err);
    }

    const { structure, competitionIdMap, stageIdMap } = await editionCloneService.cloneTournamentStructure(driver, {
      sourceTournamentId,
      newTournamentId: newId,
    });

    const sourceInscriptions = await inscriptionsClient.listTournamentInscriptions(sourceTournamentId);
    const acceptedSource = acceptedTeamInscriptions(sourceInscriptions);
    const sourceById = new Map(acceptedSource.map((r) => [String(r.id), r]));

    const nextEditionTransitions = structure.transitions.filter(isNextEditionTransitionRow);
    if (normalizedMode === 'full') {
      for (const tr of nextEditionTransitions) {
        if (!parsePlacementSnapshot(tr.placementSnapshotJson)) {
          badRequest(
            'BAD_REQUEST: faltan snapshots en transiciones next_edition; usá modo structure_only o finalizá todas las etapas'
          );
        }
      }
    } else {
      for (const tr of nextEditionTransitions) {
        if (!parsePlacementSnapshot(tr.placementSnapshotJson)) {
          warnings.push(`Sin snapshot en "${tr.label || tr.id}" — ascenso/descenso omitido`);
        }
      }
    }

    const placementsToCreate = [];
    let snapshotsApplied = 0;
    const missingPlacementIds = [];

    if (normalizedMode === 'full') {
      for (const tr of nextEditionTransitions) {
        const snapshot = parsePlacementSnapshot(tr.placementSnapshotJson);
        if (!snapshot) continue;
        snapshotsApplied += 1;

        const destStageOld = resolveDestinationStageId(tr, sourceTournamentId);
        if (!destStageOld) {
          warnings.push(`Transición "${tr.label || tr.id}" sin destino resoluble — omitida`);
          continue;
        }
        const destStageNew = stageIdMap.get(destStageOld);
        const destCompOld = structure.stageToCompetition.get(destStageOld);
        const destCompNew = competitionIdMap.get(destCompOld);
        if (!destStageNew || !destCompNew) {
          warnings.push(`Destino no mapeado para "${tr.label || tr.id}" — omitida`);
          continue;
        }

        for (const placement of snapshot.placements) {
          const sourceId = String(placement.inscriptionId ?? '').trim();
          if (!sourceById.has(sourceId)) missingPlacementIds.push(sourceId);
          placementsToCreate.push({
            sourceInscriptionId: sourceId,
            placementDisplayName: placement.displayName,
            destCompNew,
            destStageNew,
          });
        }
      }
    }

    const lookupExtra = await inscriptionsClient.lookupInscriptionsByIds(missingPlacementIds);
    for (const [id, row] of lookupExtra) {
      if (!sourceById.has(id)) sourceById.set(id, row);
    }

    const snapshotRows = [];
    for (const item of placementsToCreate) {
      const sourceRow = sourceById.get(item.sourceInscriptionId);
      if (!sourceRow) {
        warnings.push(
          `Inscripción ${item.sourceInscriptionId || item.placementDisplayName} no encontrada — omitida`
        );
        continue;
      }
      snapshotRows.push({
        sourceInscriptionId: item.sourceInscriptionId,
        displayName:
          String(sourceRow.display_name || item.placementDisplayName || '').trim() || item.placementDisplayName,
        linkedTeamId: sourceRow.linked_team_id != null ? Number(sourceRow.linked_team_id) : null,
        weight: sourceRow.weight ?? null,
        targetCompetitionId: item.destCompNew,
        targetStageId: item.destStageNew,
      });
    }
    placementsToCreate.length = 0;
    placementsToCreate.push(...snapshotRows);

    const competitionStages = buildCompetitionStages(structure);
    let permanenciesApplied = 0;

    for (const comp of structure.competitions) {
      const stageIds = competitionStages.get(comp.id) || [];
      const outgoingIds = collectOutgoingSnapshotInscriptionIds(structure.transitions, stageIds);
      const acceptedInComp = acceptedSource.filter((r) => String(r.competition_id || '') === String(comp.id));
      const permanencies = computePermanencyInscriptions(acceptedInComp, outgoingIds);
      const newCompId = competitionIdMap.get(comp.id);
      const initialStageNew = [...structure.stages]
        .filter((s) => s.competitionId === comp.id)
        .sort((a, b) => a.order - b.order)[0];
      const initialStageMapped = initialStageNew ? stageIdMap.get(initialStageNew.id) : null;
      if (!newCompId || !initialStageMapped) continue;

      for (const row of permanencies) {
        permanenciesApplied += 1;
        placementsToCreate.push({
          sourceInscriptionId: String(row.id),
          displayName: String(row.display_name || '').trim() || `Equipo ${row.id}`,
          linkedTeamId: row.linked_team_id != null ? Number(row.linked_team_id) : null,
          weight: row.weight ?? null,
          targetCompetitionId: newCompId,
          targetStageId: initialStageMapped,
        });
      }
    }

    const deduped = dedupeRowsByTeam(placementsToCreate);
    let inscriptionsCreated = 0;
    let seedOrder = 0;

    for (const row of deduped) {
      try {
        const created = await inscriptionsClient.createAcceptedTeamInscription(
          {
            tournamentId: newId,
            competitionId: row.targetCompetitionId,
            displayName: row.displayName,
            linkedTeamId: row.linkedTeamId,
            weight: row.weight,
          },
          authHeader
        );
        inscriptionsCreated += 1;
        await stageService.assignInscription(
          driver,
          row.targetStageId,
          newId,
          String(created.id),
          row.displayName,
          true,
          seedOrder
        );
        seedOrder += 1;
      } catch (err) {
        warnings.push(`No se pudo inscribir "${row.displayName}": ${err.message}`);
      }
    }

    const finalSession = driver.session();
    let createdTournament;
    try {
      createdTournament = await tournamentRepo.findById(finalSession, newId);
    } finally {
      await finalSession.close();
    }

    const linkedSeries = await seriesService.getSeriesForTournament(driver, newId);

    return {
      tournament: { ...createdTournament, seriesId: linkedSeries?.id ?? targetSeriesId },
      warnings,
      inscriptionsCreated,
      permanenciesApplied,
      snapshotsApplied,
    };
  } catch (err) {
    await rollbackTournament(driver, newTournamentId);
    if (err.extensions?.code) throw err;
    if (err.code) rethrowDomain(err);
    throw err;
  }
}
