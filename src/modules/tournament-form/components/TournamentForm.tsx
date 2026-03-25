import React from 'react';
import { Section } from './atoms/Section';
import { TextField } from './atoms/TextField';
import { SelectField } from './atoms/SelectField';
import { CompetitionsBuilder, type CompetitionMeta } from './CompetitionsBuilder';

interface TournamentFormProps {
    organizerName: string;
    onCreated?: (payload: { id: string; name: string }) => void;
}

export const TournamentForm: React.FC<TournamentFormProps> = ({ organizerName, onCreated }) => {
    type ParticipantType = 'teams' | 'individuals';
    type InscriptionMode = 'public' | 'invitation';

    interface GeneralInfo {
        name: string;
        sport: string;
        venue: string;
        organizer: string;
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
        organizer: organizerName || '',
        participantType: 'teams',
        inscriptionMode: 'public',
    });
    const [competitions, setCompetitions] = React.useState<CompetitionMeta[]>([
        { id: crypto.randomUUID(), name: 'Competición 1', stages: [] }
    ]);
    const [errors, setErrors] = React.useState<FormErrors>({});
    const [submitState, setSubmitState] = React.useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [submitMsg, setSubmitMsg] = React.useState<string>('');

    React.useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as { general?: GeneralInfo; competitions?: CompetitionMeta[] };
            if (parsed?.general) {
                setGeneral({
                    ...parsed.general,
                    organizer: organizerName || '',
                });
            }
            if (parsed?.competitions && parsed.competitions.length > 0) setCompetitions(parsed.competitions);
        } catch {}
    }, [organizerName]);

    React.useEffect(() => {
        setGeneral((prev) => ({ ...prev, organizer: organizerName || '' }));
    }, [organizerName]);

    React.useEffect(() => {
        try {
            const payload = JSON.stringify({ general, competitions });
            localStorage.setItem(STORAGE_KEY, payload);
        } catch {}
    }, [general, competitions]);

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
            const createdTournament = await gql(
                `mutation CreateTournament($name: String!, $sport: String!, $season: String, $venue: String, $organizer: String, $pt: String, $inscriptionMode: InscriptionMode!, $status: TournamentStatus!) {
                    createTournament(name: $name, sport: $sport, season: $season, venue: $venue, organizer: $organizer, participantType: $pt, inscriptionMode: $inscriptionMode, status: $status) { id name season }
                }`,
                {
                    name: general.name,
                    sport: general.sport,
                    season: null,
                    venue: general.venue || null,
                    organizer: general.organizer || null,
                    pt: general.participantType,
                    inscriptionMode: general.inscriptionMode,
                    status: 'draft',
                }
            ).then(r => r.createTournament);

            const competitionIdMap = new Map<string, string>();
            const stageIdMap = new Map<string, string>();

            // 1) Crear todas las competiciones
            for (let i = 0; i < competitions.length; i++) {
                const comp = competitions[i];
                const createdComp = await gql(
                    `mutation CreateCompetition($tid: ID!, $name: String!, $order: Int!) { createCompetition(tournamentId: $tid, name: $name, order: $order) { id name order } }`,
                    { tid: createdTournament.id, name: comp.name, order: i + 1 }
                ).then(r => r.createCompetition);
                competitionIdMap.set(comp.id, createdComp.id);
            }

            // 2) Crear todas las etapas (con config/children completos)
            for (let i = 0; i < competitions.length; i++) {
                const comp = competitions[i];
                const createdCompetitionId = competitionIdMap.get(comp.id);
                if (!createdCompetitionId) continue;
                for (let j = 0; j < (comp.stages ?? []).length; j++) {
                    const st = comp.stages[j];
                    const format = mapStageKindToFormat(st.kind);
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

            // 3) Crear todas las relaciones (internas/cross/externas y top/range/bottom)
            for (const comp of competitions) {
                for (const st of comp.stages ?? []) {
                    for (const rel of st.relations ?? []) {
                        const fromId = stageIdMap.get(st.id);
                        if (!fromId) continue;

                        // Resolver destino interno/cross dentro del torneo creado.
                        let toId: string | null = null;
                        if (rel.toStageId) {
                            toId = stageIdMap.get(rel.toStageId) ?? null;
                        } else if (rel.toExternal?.tournamentId === 'this' && rel.toExternal?.stageId) {
                            toId = stageIdMap.get(rel.toExternal.stageId) ?? null;
                        }

                        const selectionVars = selectionToVariables(rel.selection);
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
                                toExternalTournamentId: toId ? null : rel.toExternal?.tournamentId ?? null,
                                toExternalStageId: toId ? null : rel.toExternal?.stageId ?? null,
                                toExternalTournamentName: toId ? null : rel.toExternal?.tournamentName ?? null,
                                carryOverJson: rel.carryOver ? JSON.stringify(rel.carryOver) : null,
                            }
                        );
                    }
                }
            }

            setSubmitState('success');
            setSubmitMsg(`Estructura creada. Torneo: ${createdTournament.id}`);
            onCreated?.({ id: createdTournament.id, name: createdTournament.name });
        } catch (err: any) {
            setSubmitState('error');
            setSubmitMsg(err?.message || 'Error inesperado');
        }
    }

    function onSaveDraft() {
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

    return (
        <form className="space-y-8" onSubmit={onSubmit}>
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
                            {organizerName?.trim() || general.organizer?.trim() || 'Organizador'}
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
                <CompetitionsBuilder value={competitions} onChange={setCompetitions} />
            </Section>

            <div className="flex items-center justify-between border-t border-white/10 pt-6">
                <button type="button" onClick={onSaveDraft} className="btn-secondary">Guardar borrador</button>
                <button type="submit" disabled={submitState === 'submitting'} className="btn-primary">
                    {submitState === 'submitting' ? 'Enviando…' : 'Continuar'}
                </button>
            </div>

            {submitState === 'error' && submitMsg && (
                <div className="text-sm pt-2 text-red-300">{submitMsg}</div>
            )}
        </form>
    );
}; 