import React from 'react';
import { Section } from './atoms/Section';
import { TextField } from './atoms/TextField';
import { SelectField } from './atoms/SelectField';
import { CompetitionsBuilder, type CompetitionMeta } from './CompetitionsBuilder';
import type { Relation, Selection } from './stages/StageBuilder';

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

/** Rehidrata relaciones desde GraphQL (incluye toStageId cuando la etapa destino es interna). */
function mapGraphqlTransitionsToRelations(
    transitions: any[] | undefined,
    parseJson: (v: any) => Record<string, unknown> | null
): Relation[] {
    if (!Array.isArray(transitions) || transitions.length === 0) return [];
    return transitions.map((tr) => {
        const kind = String(tr.selectionKind || 'top').toLowerCase();
        let selection: Selection;
        if (kind === 'range') {
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

const TOURNAMENT_FOR_EDIT_QUERY = `
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

function deriveFormStateFromGraphqlTournament(t: any): {
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
            nextCompetitions.length > 0 ? nextCompetitions : [{ id: crypto.randomUUID(), name: 'Competición 1', stages: [] }],
        existingCompetitionIds,
        existingStageIds,
        existingTransitionIds,
    };
}

function strOrNull(v: string | undefined | null): string | null {
    if (v == null) return null;
    const t = String(v).trim();
    return t === '' ? null : t;
}

function collectRemovedTransitionIds(prev: CompetitionMeta[], next: CompetitionMeta[]): string[] {
    const prevIds = new Set(
        prev.flatMap((c) => (c.stages || []).flatMap((s) => (s.relations || []).map((r) => r.id)))
    );
    const nextIds = new Set(
        next.flatMap((c) => (c.stages || []).flatMap((s) => (s.relations || []).map((r) => r.id)))
    );
    return [...prevIds].filter((id) => !nextIds.has(id));
}

interface TournamentFormProps {
    organizerName: string;
    onCreated?: (payload: { id: string; name: string }) => void;
    onUpdated?: (payload: { id: string; name: string }) => void;
    mode?: 'create' | 'edit';
    tournamentId?: string | null;
}

export const TournamentForm: React.FC<TournamentFormProps> = ({ organizerName, onCreated, onUpdated, mode = 'create', tournamentId }) => {
    type ParticipantType = 'teams' | 'individuals';
    type InscriptionMode = 'public' | 'invitation';

    interface GeneralInfo {
        name: string;
        sport: string;
        venue: string;
        participantType: ParticipantType;
        inscriptionMode: InscriptionMode;
    }

    interface FormErrors {
        name?: string;
        sport?: string;
    }

    const STORAGE_KEY = 'liga360:tournamentDraft:v1';

    const [general, setGeneral] = React.useState<GeneralInfo>({
        name: '',
        sport: 'football',
        venue: '',
        participantType: 'teams',
        inscriptionMode: 'public',
    });
    const [competitions, setCompetitions] = React.useState<CompetitionMeta[]>([
        { id: crypto.randomUUID(), name: 'Competición 1', stages: [] }
    ]);
    const [errors, setErrors] = React.useState<FormErrors>({});
    const [submitState, setSubmitState] = React.useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [submitMsg, setSubmitMsg] = React.useState<string>('');
    const [loadingExisting, setLoadingExisting] = React.useState(false);
    const existingCompetitionIdsRef = React.useRef<Set<string>>(new Set());
    const existingStageIdsRef = React.useRef<Set<string>>(new Set());
    const existingTransitionIdsRef = React.useRef<Set<string>>(new Set());

    React.useEffect(() => {
        if (mode !== 'create') return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as { general?: GeneralInfo; competitions?: CompetitionMeta[] };
            if (parsed?.general) setGeneral(parsed.general);
            if (parsed?.competitions && parsed.competitions.length > 0) setCompetitions(parsed.competitions);
        } catch {}
    }, [mode]);

    React.useEffect(() => {
        if (mode !== 'create') return;
        try {
            const payload = JSON.stringify({ general, competitions });
            localStorage.setItem(STORAGE_KEY, payload);
        } catch {}
    }, [general, competitions, mode]);

    React.useEffect(() => {
        if (mode !== 'edit' || !tournamentId) return;
        let cancelled = false;
        (async () => {
            setLoadingExisting(true);
            setSubmitMsg('');
            try {
                const data = await gql<{ tournament: any }>(TOURNAMENT_FOR_EDIT_QUERY, { id: tournamentId });
                const t = data?.tournament;
                if (!t) throw new Error('No se encontró el torneo a editar');
                if (cancelled) return;

                const derived = deriveFormStateFromGraphqlTournament(t);
                setGeneral({
                    ...derived.general,
                    participantType: derived.general.participantType as ParticipantType,
                    inscriptionMode: derived.general.inscriptionMode as InscriptionMode,
                });
                setCompetitions(derived.competitions);
                existingCompetitionIdsRef.current = derived.existingCompetitionIds;
                existingStageIdsRef.current = derived.existingStageIds;
                existingTransitionIdsRef.current = derived.existingTransitionIds;
            } catch (err: any) {
                if (!cancelled) {
                    setSubmitState('error');
                    setSubmitMsg(err?.message || 'No se pudo cargar la estructura para edición');
                }
            } finally {
                if (!cancelled) setLoadingExisting(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [mode, tournamentId]);

    function validate(): boolean {
        const next: FormErrors = {};
        if (!general.name.trim()) next.name = 'El nombre es requerido';
        if (!general.sport.trim()) next.sport = 'El deporte es requerido';
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validate()) return;
        setSubmitState('submitting');
        setSubmitMsg('');
        try {
            const isEdit = mode === 'edit' && Boolean(tournamentId);
            const workingTournament = isEdit
                ? await gql(
                    `mutation UpdateTournament($id: ID!, $name: String!, $sport: String!, $season: String, $venue: String, $pt: String, $inscriptionMode: InscriptionMode!, $status: TournamentStatus!) {
                        updateTournament(id: $id, name: $name, sport: $sport, season: $season, venue: $venue, participantType: $pt, inscriptionMode: $inscriptionMode, status: $status) { id name season }
                    }`,
                    {
                        id: tournamentId,
                        name: general.name,
                        sport: general.sport,
                        season: null,
                        venue: general.venue || null,
                        pt: general.participantType,
                        inscriptionMode: general.inscriptionMode,
                        status: 'draft',
                    }
                ).then(r => r.updateTournament)
                : await gql(
                    `mutation CreateTournament($name: String!, $sport: String!, $season: String, $venue: String, $pt: String, $inscriptionMode: InscriptionMode!, $status: TournamentStatus!) {
                        createTournament(name: $name, sport: $sport, season: $season, venue: $venue, participantType: $pt, inscriptionMode: $inscriptionMode, status: $status) { id name season }
                    }`,
                    {
                        name: general.name,
                        sport: general.sport,
                        season: null,
                        venue: general.venue || null,
                        pt: general.participantType,
                        inscriptionMode: general.inscriptionMode,
                        status: 'draft',
                    }
                ).then(r => r.createTournament);

            const competitionIdMap = new Map<string, string>();
            const stageIdMap = new Map<string, string>();
            const existingCompetitionIds = existingCompetitionIdsRef.current;
            const existingStageIds = existingStageIdsRef.current;
            const existingTransitionIds = existingTransitionIdsRef.current;

            // 1) Crear todas las competiciones
            for (let i = 0; i < competitions.length; i++) {
                const comp = competitions[i];
                if (isEdit && existingCompetitionIds.has(comp.id)) {
                    const updatedComp = await gql(
                        `mutation UpdateCompetition($competitionId: ID!, $name: String!, $order: Int!, $maxSlots: Int) {
                            updateCompetition(competitionId: $competitionId, name: $name, order: $order, maxSlots: $maxSlots) { id }
                        }`,
                        {
                            competitionId: comp.id,
                            name: comp.name,
                            order: i + 1,
                            maxSlots: comp.maxSlots ?? null,
                        }
                    ).then((r) => r.updateCompetition);
                    competitionIdMap.set(comp.id, updatedComp.id);
                } else {
                    const createdComp = await gql(
                        `mutation CreateCompetition($tid: ID!, $name: String!, $order: Int!, $maxSlots: Int) { createCompetition(tournamentId: $tid, name: $name, order: $order, maxSlots: $maxSlots) { id name order maxSlots effectiveMaxSlots } }`,
                        { tid: workingTournament.id, name: comp.name, order: i + 1, maxSlots: comp.maxSlots ?? null }
                    ).then(r => r.createCompetition);
                    competitionIdMap.set(comp.id, createdComp.id);
                }
            }

            // 2) Crear todas las etapas (con config/children completos)
            for (let i = 0; i < competitions.length; i++) {
                const comp = competitions[i];
                const createdCompetitionId = competitionIdMap.get(comp.id);
                if (!createdCompetitionId) continue;
                for (let j = 0; j < (comp.stages ?? []).length; j++) {
                    const st = comp.stages[j];
                    const format = mapStageKindToFormat(st.kind);
                    if (isEdit && existingStageIds.has(st.id)) {
                        const updatedStage = await gql(
                            `mutation UpdateStage($stageId: ID!, $name: String!, $order: Int!, $format: StageFormat!, $configJson: String, $childrenJson: String) {
                                updateStage(stageId: $stageId, name: $name, order: $order, format: $format, configJson: $configJson, childrenJson: $childrenJson) { id }
                            }`,
                            {
                                stageId: st.id,
                                name: st.name,
                                order: j + 1,
                                format,
                                configJson: JSON.stringify(st.config ?? {}),
                                childrenJson: JSON.stringify(st.children ?? []),
                            }
                        ).then((r) => r.updateStage);
                        stageIdMap.set(st.id, updatedStage.id);
                    } else {
                        const createdStage = await gql(
                            `mutation AddStage($cid: ID!, $name: String!, $order: Int!, $format: StageFormat!, $configJson: String, $childrenJson: String) {
                                addStage(competitionId: $cid, name: $name, order: $order, format: $format, configJson: $configJson, childrenJson: $childrenJson) {
                                    id
                                }
                            }`,
                            {
                                cid: createdCompetitionId,
                                name: st.name,
                                order: j + 1,
                                format,
                                configJson: JSON.stringify(st.config ?? {}),
                                childrenJson: JSON.stringify(st.children ?? []),
                            }
                        ).then(r => r.addStage);
                        stageIdMap.set(st.id, createdStage.id);
                        if (format === 'elimination') {
                            await gql(
                                `mutation GenerateEliminationBracket($stageId: ID!) {
                                    generateEliminationBracket(stageId: $stageId) { id }
                                }`,
                                { stageId: createdStage.id }
                            );
                        }
                    }
                }
            }

            // 3) Crear relaciones nuevas (internas/cross/externas y top/range/bottom).
            // Nota: las relaciones existentes se preservan; sólo se añaden nuevas.
            for (const comp of competitions) {
                for (const st of comp.stages ?? []) {
                    for (const rel of st.relations ?? []) {
                        if (isEdit && existingTransitionIds.has(rel.id)) continue;
                        const fromId = stageIdMap.get(st.id);
                        if (!fromId) continue;

                        // Resolver destino interno/cross dentro del torneo creado.
                        let toId: string | null = null;
                        if (rel.toStageId) {
                            toId = stageIdMap.get(rel.toStageId) ?? null;
                        } else if (rel.toExternal?.tournamentId === 'this' && rel.toExternal?.stageId) {
                            toId = stageIdMap.get(rel.toExternal.stageId) ?? null;
                        }

                        if (rel.toStageId && !toId) {
                            throw new Error(
                                `No se pudo resolver la etapa destino para la relación "${rel.label}". Revisá que la etapa siga existiendo.`
                            );
                        }
                        if (rel.toExternal?.tournamentId === 'this' && rel.toExternal?.stageId && !toId) {
                            throw new Error(
                                `No se pudo resolver el destino entre competiciones para "${rel.label}" (etapa destino no encontrada). Guardá primero todas las etapas y volvé a intentar.`
                            );
                        }

                        const selectionVars = selectionToVariables(rel.selection);
                        const extTid = strOrNull(rel.toExternal?.tournamentId ?? null);
                        const extSid = strOrNull(rel.toExternal?.stageId ?? null);
                        const extName = strOrNull(rel.toExternal?.tournamentName ?? null);
                        await gql(
                            `mutation AddTransition(
                                $from: ID!,
                                $to: ID,
                                $label: String!,
                                $selectionKind: String!,
                                $topN: Int,
                                $rangeFrom: Int,
                                $rangeTo: Int,
                                $bottomN: Int,
                                $toExternalTournamentId: String,
                                $toExternalStageId: String,
                                $toExternalTournamentName: String,
                                $carryOverJson: String
                            ) {
                                addTransition(
                                    fromStageId: $from,
                                    toStageId: $to,
                                    label: $label,
                                    selectionKind: $selectionKind,
                                    topN: $topN,
                                    rangeFrom: $rangeFrom,
                                    rangeTo: $rangeTo,
                                    bottomN: $bottomN,
                                    toExternalTournamentId: $toExternalTournamentId,
                                    toExternalStageId: $toExternalStageId,
                                    toExternalTournamentName: $toExternalTournamentName,
                                    carryOverJson: $carryOverJson
                                ) { id }
                            }`,
                            {
                                from: fromId,
                                to: toId,
                                label: rel.label || 'avance',
                                selectionKind: rel.selection.kind,
                                ...selectionVars,
                                toExternalTournamentId: toId ? null : extTid,
                                toExternalStageId: toId ? null : extSid,
                                toExternalTournamentName: toId ? null : extName,
                                carryOverJson: rel.carryOver ? JSON.stringify(rel.carryOver) : null,
                            }
                        );
                    }
                }
            }

            if (isEdit && tournamentId) {
                const refreshed = await gql<{ tournament: any }>(TOURNAMENT_FOR_EDIT_QUERY, { id: tournamentId });
                const tr = refreshed?.tournament;
                if (tr) {
                    const derived = deriveFormStateFromGraphqlTournament(tr);
                    setGeneral({
                        ...derived.general,
                        participantType: derived.general.participantType as ParticipantType,
                        inscriptionMode: derived.general.inscriptionMode as InscriptionMode,
                    });
                    setCompetitions(derived.competitions);
                    existingCompetitionIdsRef.current = derived.existingCompetitionIds;
                    existingStageIdsRef.current = derived.existingStageIds;
                    existingTransitionIdsRef.current = derived.existingTransitionIds;
                }
            }

            setSubmitState('success');
            setSubmitMsg(
                isEdit
                    ? `Estructura actualizada. Torneo: ${workingTournament.id}`
                    : `Estructura creada. Torneo: ${workingTournament.id}`
            );
            if (isEdit) onUpdated?.({ id: workingTournament.id, name: workingTournament.name });
            else onCreated?.({ id: workingTournament.id, name: workingTournament.name });
        } catch (err: any) {
            setSubmitState('error');
            setSubmitMsg(err?.message || 'Error inesperado');
        }
    }

    function onSaveDraft() {
        if (mode !== 'create') return;
        try {
            const payload = JSON.stringify({ general, competitions });
            localStorage.setItem(STORAGE_KEY, payload);
            setSubmitState('success');
            setSubmitMsg('Borrador guardado');
        } catch {
            setSubmitState('error');
            setSubmitMsg('No se pudo guardar el borrador');
        }
    }

    async function gql<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
        const token = localStorage.getItem('liga360:token');
        const res = await fetch('http://localhost:4000/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ query, variables })
        });
        const json = await res.json();
        if (json.errors) throw new Error(json.errors?.[0]?.message || 'GraphQL error');
        return json.data as T;
    }

    function mapStageKindToFormat(kind: string): 'league' | 'groups' | 'elimination' | 'composed' {
        if (kind === 'knockout') return 'elimination';
        if (kind === 'composed') return 'composed';
        return kind as 'league' | 'groups' | 'elimination' | 'composed';
    }

    function selectionToVariables(selection: any): {
        topN: number | null;
        rangeFrom: number | null;
        rangeTo: number | null;
        bottomN: number | null;
    } {
        if (selection?.kind === 'top') {
            return { topN: Number(selection.count) || 0, rangeFrom: null, rangeTo: null, bottomN: null };
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

    function handleCompetitionsChange(next: CompetitionMeta[]) {
        const removed = collectRemovedTransitionIds(competitions, next);
        setCompetitions(next);

        if (mode !== 'edit' || !tournamentId || removed.length === 0) return;

        const toDelete = removed.filter((id) => existingTransitionIdsRef.current.has(id));
        if (toDelete.length === 0) return;

        void (async () => {
            for (const tid of toDelete) {
                try {
                    await gql<{ deleteTransition: boolean }>(
                        `mutation DeleteTransition($id: ID!) { deleteTransition(transitionId: $id) }`,
                        { id: tid }
                    );
                    existingTransitionIdsRef.current.delete(tid);
                } catch (err: unknown) {
                    setSubmitState('error');
                    setSubmitMsg(err instanceof Error ? err.message : 'No se pudo eliminar la relación en el servidor');
                    try {
                        const data = await gql<{ tournament: any }>(TOURNAMENT_FOR_EDIT_QUERY, { id: tournamentId });
                        const tr = data?.tournament;
                        if (tr) {
                            const derived = deriveFormStateFromGraphqlTournament(tr);
                            setGeneral({
                                ...derived.general,
                                participantType: derived.general.participantType as ParticipantType,
                                inscriptionMode: derived.general.inscriptionMode as InscriptionMode,
                            });
                            setCompetitions(derived.competitions);
                            existingCompetitionIdsRef.current = derived.existingCompetitionIds;
                            existingStageIdsRef.current = derived.existingStageIds;
                            existingTransitionIdsRef.current = derived.existingTransitionIds;
                        }
                    } catch {
                        /* ignorar fallo de refetch */
                    }
                    break;
                }
            }
        })();
    }

    return (
        <form className="space-y-8" onSubmit={onSubmit}>
            {loadingExisting ? <div className="text-sm text-slate-500">Cargando estructura existente...</div> : null}
            <Section title="Información general" subtitle="Define los datos básicos del torneo">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <TextField
                            label="Nombre del torneo"
                            placeholder="Ej: Apertura 2025"
                            required
                            name="name"
                            value={general.name}
                            onChange={(e) => {
                                const target = e?.currentTarget;
                                if (!target) return;
                                const v = target.value ?? '';
                                setGeneral((g) => ({ ...g, name: v }));
                            }}
                        />
                        {errors.name && <div className="text-xs text-red-300 mt-1">{errors.name}</div>}
                    </div>
                    <div>
                        <SelectField
                            label="Deporte"
                            name="sport"
                            value={general.sport}
                            onChange={(value) => {
                                const v = value || 'football';
                                setGeneral((g) => ({ ...g, sport: v }));
                            }}
                            options={[
                                { label: 'Fútbol', value: 'football' },
                                { label: 'Tenis', value: 'tennis' },
                            ]}
                        />
                        {errors.sport && <div className="text-xs text-red-300 mt-1">{errors.sport}</div>}
                    </div>
                    <TextField
                        label="Sede/Ubicación"
                        placeholder="Ej: Buenos Aires"
                        name="venue"
                        value={general.venue}
                        onChange={(e) => {
                            const target = e?.currentTarget;
                            if (!target) return;
                            const v = target.value ?? '';
                            setGeneral((g) => ({ ...g, venue: v }));
                        }}
                    />
                    <div className="space-y-1">
                        <span className="text-sm font-medium text-slate-700">Organizador</span>
                        <p className="text-sm font-semibold text-slate-800">
                            {organizerName?.trim() || 'Organizador'}
                        </p>
                    </div>
                    <SelectField
                        label="Tipo de participantes"
                        name="participantType"
                        value={general.participantType}
                        onChange={(value) => {
                            const v = (value || 'teams') as ParticipantType;
                            setGeneral((g) => ({ ...g, participantType: v }));
                        }}
                        options={[{ label: 'Equipos', value: 'teams' }, { label: 'Participantes', value: 'individuals' }]}
                    />
                    <SelectField
                        label="Tipo de inscripción"
                        name="inscriptionMode"
                        value={general.inscriptionMode}
                        onChange={(value) => {
                            const v = (value || 'public') as InscriptionMode;
                            setGeneral((g) => ({ ...g, inscriptionMode: v }));
                        }}
                        options={[{ label: 'Pública', value: 'public' }, { label: 'Por invitación', value: 'invitation' }]}
                    />
                </div>
            </Section>

            <Section title="Estructura del torneo" subtitle="Cada solapa define una competencia secuencial; las solapas entre sí no son secuenciales">
                <CompetitionsBuilder value={competitions} onChange={handleCompetitionsChange} />
            </Section>

            <div className="flex items-center justify-between border-t border-white/10 pt-6">
                <button type="button" onClick={onSaveDraft} className="btn-secondary" disabled={mode !== 'create'}>Guardar borrador</button>
                <button type="submit" disabled={submitState === 'submitting'} className="btn-primary">
                    {submitState === 'submitting' ? 'Enviando…' : mode === 'edit' ? 'Guardar cambios' : 'Continuar'}
                </button>
            </div>

            {submitState === 'error' && submitMsg && (
                <div className="text-sm pt-2 text-red-300">{submitMsg}</div>
            )}
        </form>
    );
}; 