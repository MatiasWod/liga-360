import type { CompetitionMeta } from '../components/CompetitionsBuilder';
import type { Relation, Selection } from '../components/stages/StageBuilder';

function parseJsonSafe(value: any): any {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function mapStageFormatToKind(format: string): 'groups' | 'league' | 'knockout' | 'composed' {
  if (format === 'elimination') return 'knockout';
  if (format === 'composed') return 'composed';
  return format as 'groups' | 'league';
}

function mapGraphqlTransitionsToRelations(
  transitions: any[] | undefined,
  parseJson: (v: any) => Record<string, unknown> | null
): Relation[] {
  if (!Array.isArray(transitions) || transitions.length === 0) return [];
  return transitions.map((tr) => {
    const kind = String(tr.selectionKind || 'top').toLowerCase();
    let selection: Selection;
    if (kind === 'bestn') {
      selection = {
        kind: 'bestN',
        count: Number(tr.topN) || 0,
        fromPosition: Number(tr.rangeFrom) || 0,
      };
    } else if (kind === 'range') {
      selection = {
        kind: 'range',
        from: Number(tr.rangeFrom) || 0,
        to: Number(tr.rangeTo) || 0,
      };
    } else if (kind === 'bottom') {
      selection = { kind: 'bottom', count: Number(tr.bottomN) || 0 };
    } else {
      selection = { kind: 'top', count: Number(tr.topN) || 0 };
    }
    const id = String(tr.id);
    const label = String(tr.label || 'avance');
    const carryRaw = tr.carryOverJson != null ? parseJson(tr.carryOverJson) : null;
    const carryOver =
      carryRaw && typeof carryRaw === 'object' && !Array.isArray(carryRaw)
        ? (carryRaw as unknown as Relation['carryOver'])
        : undefined;

    if (tr.toStageId) {
      return {
        id,
        label,
        toStageId: String(tr.toStageId),
        selection,
        ...(carryOver ? { carryOver } : {}),
      };
    }
    const extTid = tr.toExternalTournamentId != null ? String(tr.toExternalTournamentId) : '';
    const extSid = tr.toExternalStageId != null ? String(tr.toExternalStageId) : '';
    if (extTid || extSid) {
      return {
        id,
        label,
        selection,
        toExternal: {
          tournamentId: extTid,
          stageId: extSid,
          tournamentName: tr.toExternalTournamentName ?? undefined,
        },
        ...(carryOver ? { carryOver } : {}),
      };
    }
    return { id, label, selection, ...(carryOver ? { carryOver } : {}) };
  });
}

export const TOURNAMENT_FOR_EDIT_QUERY = `
    query TournamentForEdit($id: ID!) {
        tournament(id: $id) {
            id
            name
            sport
            venue
            participantType
            inscriptionMode
            status
            competitions {
                id
                name
                order
                maxSlots
                stages {
                    id
                    name
                    order
                    format
                    configJson
                    childrenJson
                    transitions {
                        id
                        label
                        toStageId
                        selectionKind
                        topN
                        rangeFrom
                        rangeTo
                        bottomN
                        toExternalTournamentId
                        toExternalStageId
                        toExternalTournamentName
                        carryOverJson
                    }
                }
            }
        }
    }
`;

export function deriveFormStateFromGraphqlTournament(t: any): {
  general: {
    name: string;
    sport: string;
    venue: string;
    participantType: string;
    inscriptionMode: string;
  };
  competitions: CompetitionMeta[];
  existingCompetitionIds: Set<string>;
  existingStageIds: Set<string>;
  existingTransitionIds: Set<string>;
} {
  const nextCompetitions: CompetitionMeta[] = (t.competitions || [])
    .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
    .map((competition: any) => ({
      id: String(competition.id),
      name: String(competition.name || ''),
      maxSlots: competition.maxSlots == null ? null : Number(competition.maxSlots),
      stages: (competition.stages || [])
        .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
        .map((stage: any) => ({
          id: String(stage.id),
          name: String(stage.name || ''),
          kind: mapStageFormatToKind(String(stage.format || 'league')),
          config: parseJsonSafe(stage.configJson) || {},
          children: parseJsonSafe(stage.childrenJson) || [],
          relations: mapGraphqlTransitionsToRelations(stage.transitions, parseJsonSafe),
        })),
    }));

  const existingCompetitionIds = new Set<string>(nextCompetitions.map((c) => c.id));
  const existingStageIds = new Set<string>(
    nextCompetitions.flatMap((c) => (c.stages || []).map((s) => s.id))
  );
  const existingTransitionIds = new Set<string>(
    (t.competitions || []).flatMap((competition: any) =>
      (competition.stages || []).flatMap((stage: any) =>
        (stage.transitions || []).map((transition: any) => String(transition.id))
      )
    )
  );

  return {
    general: {
      name: String(t.name || ''),
      sport: String(t.sport || 'football'),
      venue: String(t.venue || ''),
      participantType: String(t.participantType || 'teams'),
      inscriptionMode: String(t.inscriptionMode || 'public'),
    },
    competitions:
      nextCompetitions.length > 0
        ? nextCompetitions
        : [{ id: crypto.randomUUID(), name: 'Competición 1', stages: [] }],
    existingCompetitionIds,
    existingStageIds,
    existingTransitionIds,
  };
}

export function strOrNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

export function collectRemovedTransitionIds(prev: CompetitionMeta[], next: CompetitionMeta[]): string[] {
  const prevIds = new Set(
    prev.flatMap((c) => (c.stages || []).flatMap((s) => (s.relations || []).map((r) => r.id)))
  );
  const nextIds = new Set(
    next.flatMap((c) => (c.stages || []).flatMap((s) => (s.relations || []).map((r) => r.id)))
  );
  return [...prevIds].filter((id) => !nextIds.has(id));
}

export function mapStageKindToFormat(kind: string): 'league' | 'groups' | 'elimination' | 'composed' {
  if (kind === 'knockout') return 'elimination';
  if (kind === 'composed') return 'composed';
  return kind as 'league' | 'groups' | 'elimination' | 'composed';
}

export function selectionToVariables(selection: any): {
  topN: number | null;
  rangeFrom: number | null;
  rangeTo: number | null;
  bottomN: number | null;
} {
  if (selection?.kind === 'top') {
    return { topN: Number(selection.count) || 0, rangeFrom: null, rangeTo: null, bottomN: null };
  }
  if (selection?.kind === 'bestN') {
    // bestN reuses topN for count and rangeFrom for position; rangeTo intentionally null
    return {
      topN: Number(selection.count) || 0,
      rangeFrom: Number(selection.fromPosition) || 0,
      rangeTo: null,
      bottomN: null,
    };
  }
  if (selection?.kind === 'range') {
    return {
      topN: null,
      rangeFrom: Number(selection.from) || 0,
      rangeTo: Number(selection.to) || 0,
      bottomN: null,
    };
  }
  return {
    topN: null,
    rangeFrom: null,
    rangeTo: null,
    bottomN: Number(selection?.count) || 0,
  };
}
