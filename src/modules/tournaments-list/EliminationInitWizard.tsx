import React from 'react';
import { Button } from '../../components/ui/Button';
import type { InscriptionItem } from '../../services/inscriptionsApi';
import {
  assignInscriptionToMatchSlot,
  generateSingleEliminationBracket,
  trimEliminationBracketAfterRound,
} from '../../services/tournaments/configuration';
import type { TournamentEntity, TournamentMatchRow, TournamentStage } from './types';
import {
  buildEliminationTruncatePreview,
  buildSameStageWinnerSlotId,
  eliminationRoundLegSteps,
  inscriptionIdsAssignedAnywhereInMatches,
  inscriptionIdsUsedElsewhere,
  matchesForRoundLeg,
  matchDisplayCode,
  parseSameStageWinnerSlotId,
  sortEliminationInitMatches,
  type EliminationRoundLegKey,
} from './eliminationInitHelpers';
import {
  collectIncomingTransitionRows,
  deriveEligibleInscriptionsFromIncomingTransitions,
  buildSectionTitle,
  type EligibleInscription,
} from './incomingTransitionEligibility';
import { BracketParticipantPicker } from './BracketParticipantPicker';
import type { ParticipantPoolSection, PoolEntry } from './bracketParticipantPool';
import { filterPoolSectionsForRole, normPoolId } from './bracketParticipantPool';

export interface EliminationInitWizardProps {
  tournamentId: string;
  tournament: TournamentEntity;
  stage: TournamentStage;
  participantPoolItems: ReadonlyArray<{ id: string | number; display_name: string }>;
  inscriptionById: Map<string, InscriptionItem>;
  onReload: () => Promise<void>;
  setSaving: (loading: boolean) => void;
  setError: (msg: string) => void;
}

function parseDoubleRound(stage: TournamentStage): boolean {
  try {
    const c = JSON.parse(stage.configJson || '{}') as Record<string, unknown>;
    return c.matchesPerTie === 'double';
  } catch {
    return false;
  }
}

export function resolveStageName(tournament: TournamentEntity, stageId?: string | null): string | null {
  if (!stageId) return null;
  for (const co of tournament.competitions || []) {
    for (const st of co.stages || []) {
      if (st.id === stageId) return st.name;
    }
  }
  return null;
}

function buildParticipantPoolSections(
  tournament: TournamentEntity,
  stage: TournamentStage,
  poolItems: ReadonlyArray<{ id: string | number; display_name: string }>,
  inscriptionById: Map<string, InscriptionItem>,
  eligibleFromTables: ReadonlyArray<EligibleInscription>,
  /** Paso > primera ronda: el cupo solo lista inscripciones que aún no están en ninguna llave. */
  idsAlreadyOnEliminationBracket?: ReadonlySet<string> | null
): ParticipantPoolSection[] {
  const seen = new Set<string>();
  const tournamentName = String(tournament.name || '').trim() || 'Torneo';
  const stageName = String(stage.name || '').trim() || 'Etapa';

  const cmpLabel = (a: PoolEntry, b: PoolEntry): number => {
    const la = a.kind === 'inscription' ? a.item.display_name : a.displayName;
    const lb = b.kind === 'inscription' ? b.item.display_name : b.displayName;
    return String(la || '').localeCompare(String(lb || ''), 'es', { sensitivity: 'base' });
  };

  /** 1) Priorizar clasificados desde tablas (G1P9 · …): si están también en cupo, gana esta etiqueta. */
  const groupedEligible = new Map<string, PoolEntry[]>();
  for (const el of eligibleFromTables) {
    const sid = String(el.inscriptionId).trim();
    if (!sid || seen.has(sid)) continue;
    seen.add(sid);
    const shown = String(el.optionLabel || el.displayName || '').trim() || sid;
    const entry: PoolEntry = { kind: 'assigned', id: sid, displayName: shown };
    const list = groupedEligible.get(el.sectionTitle);
    if (list) list.push(entry);
    else groupedEligible.set(el.sectionTitle, [entry]);
  }

  const titleOrder: string[] = [];
  const seenTitles = new Set<string>();
  for (const el of eligibleFromTables) {
    if (!seenTitles.has(el.sectionTitle)) {
      seenTitles.add(el.sectionTitle);
      titleOrder.push(el.sectionTitle);
    }
  }

  const cupoEntries: PoolEntry[] = [];
  for (const it of poolItems) {
    const sid = String(it.id);
    if (idsAlreadyOnEliminationBracket?.has(sid)) continue;
    if (seen.has(sid)) continue;
    seen.add(sid);
    cupoEntries.push({ kind: 'inscription', item: it });
  }
  cupoEntries.sort(cmpLabel);

  const assignedEntries: PoolEntry[] = [];
  for (const ai of stage.assignedInscriptions || []) {
    const sid = String(ai.inscriptionId);
    if (seen.has(sid)) continue;
    if (inscriptionById.has(sid)) continue;
    seen.add(sid);
    const dn = String((ai.displayName || '').trim() || sid);
    assignedEntries.push({ kind: 'assigned', id: sid, displayName: dn });
  }
  assignedEntries.sort(cmpLabel);

  const sections: ParticipantPoolSection[] = [];

  for (const tl of titleOrder) {
    const ent = groupedEligible.get(tl);
    if (!ent || ent.length === 0) continue;
    ent.sort(cmpLabel);
    sections.push({ sectionLabel: tl, entries: ent });
  }

  const cupoLabel = buildSectionTitle(tournamentName, '', '', 'Cupo');
  if (cupoEntries.length > 0) sections.push({ sectionLabel: cupoLabel, entries: cupoEntries });

  const assignedLabel = buildSectionTitle(tournamentName, '', stageName, 'Asignados en configuración');
  if (assignedEntries.length > 0) sections.push({ sectionLabel: assignedLabel, entries: assignedEntries });

  return sections;
}

function normId(id: string | null | undefined): string {
  return normPoolId(id);
}

export const EliminationInitWizard: React.FC<EliminationInitWizardProps> = ({
  tournamentId,
  tournament,
  stage,
  participantPoolItems,
  inscriptionById,
  onReload,
  setSaving,
  setError,
}) => {
  const matchesInput = React.useMemo(
    () => sortEliminationInitMatches(stage.matches || []),
    [stage.matches]
  );
  const steps = React.useMemo(() => eliminationRoundLegSteps(matchesInput), [matchesInput]);

  const [stepIndex, setStepIndex] = React.useState(0);
  const [slotBusyKey, setSlotBusyKey] = React.useState<string | null>(null);
  const [finalizeBusy, setFinalizeBusy] = React.useState(false);

  const doubleRound = React.useMemo(() => parseDoubleRound(stage), [stage.configJson]);

  React.useEffect(() => {
    setStepIndex((prev) =>
      steps.length === 0 ? 0 : Math.min(Math.max(0, prev), Math.max(0, steps.length - 1))
    );
  }, [stage.id, steps.length]);

  const currentKey = steps[stepIndex] as EliminationRoundLegKey | undefined;
  const currentMatches = currentKey ? matchesForRoundLeg(matchesInput, currentKey) : [];

  const eligibleFromTables = React.useMemo(
    () => deriveEligibleInscriptionsFromIncomingTransitions(tournament, stage.id),
    [tournament, stage.id]
  );

  const incomingTransitionCount = React.useMemo(
    () => collectIncomingTransitionRows(tournament, stage.id).length,
    [tournament, stage.id]
  );

  const poolSections = React.useMemo(() => {
    const tournamentName = String(tournament.name || '').trim() || 'Torneo';
    const stageNameTrim = String(stage.name || '').trim() || 'Etapa';
    const idsForStrictCupo = stepIndex > 0 ? inscriptionIdsAssignedAnywhereInMatches(matchesInput) : null;
    const base = buildParticipantPoolSections(
      tournament,
      stage,
      participantPoolItems,
      inscriptionById,
      eligibleFromTables,
      idsForStrictCupo
    );

    if (stepIndex <= 0 || steps.length === 0) return base;

    const prevById = new Map<string, TournamentMatchRow>();
    for (let i = 0; i < stepIndex; i += 1) {
      const ky = steps[i];
      if (!ky) continue;
      for (const mm of matchesForRoundLeg(matchesInput, ky)) {
        prevById.set(mm.id, mm);
      }
    }
    const prevSorted = sortEliminationInitMatches([...prevById.values()]);

    const winnerLabel = buildSectionTitle(tournamentName, '', stageNameTrim, 'Ganadores · llaves previas');
    const winners: PoolEntry[] = [];
    const seenSynth = new Set<string>();
    for (const mm of prevSorted) {
      const synth = buildSameStageWinnerSlotId(stage.id, mm.id);
      if (seenSynth.has(synth)) continue;
      seenSynth.add(synth);
      const code = matchDisplayCode(mm);
      winners.push({
        kind: 'assigned',
        id: synth,
        displayName: `Ganador · ${code} — pendiente`,
      });
    }
    if (winners.length === 0) return base;

    const cupoLabel = buildSectionTitle(tournamentName, '', '', 'Cupo');
    const cupoIx = base.findIndex((s) => s.sectionLabel === cupoLabel);
    const insertAt = cupoIx >= 0 ? cupoIx : base.length;
    const winSec: ParticipantPoolSection = { sectionLabel: winnerLabel, entries: winners };
    return [...base.slice(0, insertAt), winSec, ...base.slice(insertAt)];
  }, [
    tournament,
    stage,
    participantPoolItems,
    inscriptionById,
    eligibleFromTables,
    stepIndex,
    steps,
    matchesInput,
  ]);

  const participantOriginsLine = React.useMemo(() => {
    const rows = collectIncomingTransitionRows(tournament, stage.id);
    if (rows.length === 0) return '';
    return rows
      .map(
        ({ fromCompetitionName, fromStage }) =>
          `${String(fromCompetitionName || '').trim()}: ${String(fromStage.name || '').trim()}`
      )
      .join(' · ');
  }, [tournament, stage.id]);

  const hasInboundElimination = React.useMemo(
    () =>
      collectIncomingTransitionRows(tournament, stage.id).some(
        (r) => String(r.fromStage.format || '').toLowerCase() === 'elimination'
      ),
    [tournament, stage.id]
  );

  const showEliminationFeedHint =
    hasInboundElimination &&
    !eligibleFromTables.some((e) => e.source === 'elimination') &&
    matchesInput.length > 0;

  const showStandingsHint =
    incomingTransitionCount > 0 && eligibleFromTables.length === 0 && matchesInput.length > 0;
  /** IDs ya usadas en otros partidos (no cuenta el partido elegido desde matchId). */
  const blockedGloballyExceptMatch = React.useMemo(
    () => (excludeMatchId: string) =>
      inscriptionIdsUsedElsewhere(matchesInput, excludeMatchId),
    [matchesInput]
  );

  const wizardRoundFromStep = React.useMemo(() => {
    const k = steps[stepIndex];
    if (!k) return 1;
    return Number(String(k.split('|')[0])) || 1;
  }, [steps, stepIndex]);

  const truncatePreview = React.useMemo(
    () => buildEliminationTruncatePreview(matchesInput, wizardRoundFromStep),
    [matchesInput, wizardRoundFromStep]
  );

  const showTruncatePanel = matchesInput.length > 0 && truncatePreview.removableMatchesCount > 0;

  async function finalizeEliminationTruncation() {
    if (truncatePreview.removableMatchesCount <= 0) return;
    const ok = window.confirm(
      `¿Cerrar el cuadro al final de la ronda ${wizardRoundFromStep}?\n\n` +
        `Se borrarán ${truncatePreview.removableMatchesCount} llave(s) de rondas posteriores (no reversible).\n` +
        `Quedan ${truncatePreview.clasificatorioLlaveCodes.length} cupo(s) para la siguiente etapa (ganadores de la ronda ${wizardRoundFromStep}).\n\n` +
        '¿Continuar?'
    );
    if (!ok) return;
    setFinalizeBusy(true);
    setError('');
    try {
      await trimEliminationBracketAfterRound({
        stageId: stage.id,
        tournamentId,
        lastRoundInclusive: wizardRoundFromStep,
      });
      setStepIndex(0);
      await onReload();
    } catch (e: any) {
      setError(e?.message || 'No se pudo acortar el cuadro');
    } finally {
      setFinalizeBusy(false);
    }
  }

  async function generateBracket() {
    setSaving(true);
    setError('');
    try {
      await generateSingleEliminationBracket(stage.id, doubleRound);
      await onReload();
    } catch (e: any) {
      setError(e?.message || 'No se pudo generar el bracket');
    } finally {
      setSaving(false);
    }
  }

  async function assignSlot(match: TournamentMatchRow, role: 'home' | 'away', rawId: string) {
    const nextId = rawId === '' ? null : String(rawId);
    const displayName =
      nextId == null
        ? null
        : (() => {
            const fromWinner = parseSameStageWinnerSlotId(stage.id, nextId);
            if (fromWinner) {
              const wm = matchesInput.find((x) => x.id === fromWinner);
              if (wm) return `Ganador · ${matchDisplayCode(wm)} — pendiente`;
            }
            const fromMap = inscriptionById.get(String(nextId));
            if (fromMap) return fromMap.display_name;
            const fromEl = eligibleFromTables.find((e) => String(e.inscriptionId) === String(nextId));
            if (fromEl) return fromEl.displayName;
            const fromAssigned = (stage.assignedInscriptions || []).find(
              (a) => String(a.inscriptionId) === String(nextId)
            );
            return fromAssigned?.displayName ?? String(nextId);
          })();

    const key = `${match.id}-${role}`;
    setSlotBusyKey(key);
    setSaving(true);
    setError('');
    try {
      await assignInscriptionToMatchSlot({
        stageId: stage.id,
        matchId: match.id,
        slotRole: role,
        inscriptionId: nextId,
        tournamentId,
        displayName: displayName ?? undefined,
      });
      // En doble vuelta, auto-asignar la pierna 2 con roles invertidos
      if (doubleRound) {
        const leg2 = matchesInput.find(
          (m) =>
            (m.round ?? 1) === (match.round ?? 1) &&
            (m.slotIndex ?? 0) === (match.slotIndex ?? 0) &&
            (m.leg ?? 1) === 2
        );
        if (leg2) {
          const reversedRole = role === 'home' ? 'away' : 'home';
          await assignInscriptionToMatchSlot({
            stageId: stage.id,
            matchId: leg2.id,
            slotRole: reversedRole,
            inscriptionId: nextId,
            tournamentId,
            displayName: displayName ?? undefined,
          });
        }
      }
      await onReload();
    } catch (e: any) {
      setError(e?.message || 'No se pudo asignar el slot');
    } finally {
      setSlotBusyKey(null);
      setSaving(false);
    }
  }

  if (matchesInput.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-subtle bg-surface-1 px-4 py-6 text-center">
        <p className="mb-2 text-sm text-text-muted">
          No hay partidos de eliminatoria generados para esta etapa.
        </p>
        <Button type="button" variant="secondary" onClick={() => void generateBracket()}>
          Generar bracket eliminatorio
        </Button>
        <p className="mt-2 text-[11px] text-text-subtle">
          Hace falta cupo o participantes definidos en la configuración de la etapa.
        </p>
      </div>
    );
  }

  const [rStr] = (currentKey || '1|1').split('|');
  const rNum = Number(rStr) || 1;
  const stepLabel = doubleRound ? `Ronda ${rNum} · ida y vuelta` : `Ronda ${rNum}`;
  const totalSteps = steps.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {stepLabel} · {currentMatches.length}{' '}
            {currentMatches.length === 1 ? 'partido' : 'partidos'}
          </p>
          <p className="text-[11px] text-text-muted">
            Paso {stepIndex + 1} de {totalSteps}
            {doubleRound
              ? ' · Asignás local y visitante de la ida; la vuelta se configura automáticamente en reversa.'
              : ' · Podés ubicar equipo libre, clasificados, o pendientes de llaves ya creadas (ganador de una llave anterior).'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={stepIndex <= 0}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={stepIndex >= totalSteps - 1}
            onClick={() => setStepIndex((i) => Math.min(totalSteps - 1, i + 1))}
          >
            Siguiente
          </Button>
        </div>
      </div>

      {participantOriginsLine ? (
        <p className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-[11px] leading-snug text-text-muted">
          <span className="font-medium text-text-primary">Participantes · orígenes: </span>
          {participantOriginsLine}
        </p>
      ) : null}

      {showStandingsHint ? (
        <p className="rounded-lg border border-dashed border-border-subtle bg-surface-2 px-3 py-2 text-[11px] leading-snug text-text-muted">
          Hay relaciones desde otras fases configuradas; aún no se listan clasificados desde las tablas. Verificá que la
          etapa de origen tenga posiciones calculadas (partidos finalizados) o que el rango de puestos coincida con las
          tablas.
        </p>
      ) : null}

      {showEliminationFeedHint ? (
        <p className="rounded-lg border border-dashed border-border-subtle bg-surface-2 px-3 py-2 text-[11px] leading-snug text-text-muted">
          Hay una transición desde una etapa eliminatoria pero no aparecen equipos: en esa etapa, marcá como avance desde
          cada llave los partidos cuyos ganadores alimentan esta fase (vinculación de cupos desde eliminatoria en el
          torneo).
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {currentMatches.map((m) => {
          const title = matchDisplayCode(m);
          const homeVal = normId(m.homeAssignedInscription?.inscriptionId);
          const awayVal = normId(m.awayAssignedInscription?.inscriptionId);
          const blockedElsewhere = inscriptionIdsUsedElsewhere(matchesInput, m.id);

          const homeBusy = slotBusyKey === `${m.id}-home`;
          const awayBusy = slotBusyKey === `${m.id}-away`;

          const resetKey = `${currentKey}-${m.id}`;
          const homeSections = filterPoolSectionsForRole(poolSections, 'home', m, blockedElsewhere);
          const awaySections = filterPoolSectionsForRole(poolSections, 'away', m, blockedElsewhere);

          return (
            <div
              key={`${m.id}-${currentKey}`}
              className="relative z-10 overflow-visible rounded-xl border border-border-subtle bg-surface-1 p-3 shadow-sm"
            >
              <p className="mb-3 text-center font-mono text-sm font-semibold tracking-tight text-success-base">
                {title}
                {doubleRound && (
                  <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 font-sans text-[10px] font-normal text-blue-700">
                    ida y vuelta
                  </span>
                )}
              </p>

              <div className="space-y-2">
                <label className="block text-[11px] font-medium uppercase text-text-muted">
                  Local
                  <BracketParticipantPicker
                    ariaLabel={`Local · ${title}`}
                    resetSignal={`${resetKey}-home`}
                    sections={homeSections}
                    disabled={homeBusy || awayBusy}
                    value={homeVal}
                    emptyLabel="Sin asignar"
                    onChange={(rid) => void assignSlot(m, 'home', rid)}
                  />
                </label>

                <label className="block text-[11px] font-medium uppercase text-text-muted">
                  Visitante
                  <BracketParticipantPicker
                    ariaLabel={`Visitante · ${title}`}
                    resetSignal={`${resetKey}-away`}
                    sections={awaySections}
                    disabled={homeBusy || awayBusy}
                    value={awayVal}
                    emptyLabel="Sin asignar"
                    onChange={(rid) => void assignSlot(m, 'away', rid)}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {showTruncatePanel ? (
        <div className="rounded-lg border border-border-subtle bg-surface-2 p-3">
          <p className="text-[11px] leading-snug text-text-muted">
            <span className="font-medium text-text-primary">Ronda {wizardRoundFromStep}:</span> se quitan{' '}
            <strong className="text-text-primary">{truncatePreview.removableMatchesCount}</strong> llave
            {truncatePreview.removableMatchesCount !== 1 ? 's' : ''} posteriores · la siguiente etapa toma{' '}
            <strong className="text-success-base">{truncatePreview.clasificatorioLlaveCodes.length}</strong> cupo
            {truncatePreview.clasificatorioLlaveCodes.length !== 1 ? 's' : ''} (ganadores de estas llaves):{' '}
            <span className="font-mono text-[10px] tracking-tight text-text-primary">
              {truncatePreview.clasificatorioLlaveCodes.map((c) => c.replace(/-/g, '')).join(' ')}
            </span>
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-2"
            disabled={finalizeBusy}
            onClick={() => void finalizeEliminationTruncation()}
          >
            {finalizeBusy ? 'Aplicando…' : `Finalizar etapa tras ronda ${wizardRoundFromStep}`}
          </Button>
        </div>
      ) : null}

      <p className="text-[11px] text-text-subtle">
        Podés dejar últimas llaves sin relleno si clasificás un subconjunto; el fixture completo está en la pestaña
        Fixture para fechas y resultados.
      </p>
    </div>
  );
};
