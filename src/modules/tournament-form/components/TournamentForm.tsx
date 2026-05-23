import React from 'react';
import { Section } from './atoms/Section';
import { TextField } from './atoms/TextField';
import { SelectField } from './atoms/SelectField';
import { CompetitionsBuilder, type CompetitionMeta } from './CompetitionsBuilder';
import {
    collectRemovedTransitionIds,
    deriveFormStateFromGraphqlTournament,
    mapStageKindToFormat,
    selectionToVariables,
    strOrNull,
} from '../services/tournamentMapping';
import {
    createCompetition,
    createStage,
    createTournamentDraft,
    createTransition,
    deleteTransition,
    generateEliminationBracket,
    getTournamentForEdit,
    updateCompetition,
    updateStage,
    updateTournamentDraft,
} from '../services/tournamentStructureApi';
import { trimEliminationBracketAfterRound } from '../../../services/tournaments/configuration';

interface TournamentFormProps {
    organizerName: string;
    onCreated?: (payload: { id: string; name: string }) => void;
    onUpdated?: (payload: { id: string; name: string }) => void;
    mode?: 'create' | 'edit';
    tournamentId?: string | null;
    initialCompetitions?: CompetitionMeta[];
}

export const TournamentForm: React.FC<TournamentFormProps> = ({ organizerName, onCreated, onUpdated, mode = 'create', tournamentId, initialCompetitions }) => {
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
    const [competitions, setCompetitions] = React.useState<CompetitionMeta[]>(
        initialCompetitions ?? [{ id: crypto.randomUUID(), name: 'Competición 1', stages: [] }]
    );
    const [errors, setErrors] = React.useState<FormErrors>({});
    const [submitState, setSubmitState] = React.useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [submitMsg, setSubmitMsg] = React.useState<string>('');
    const [loadingExisting, setLoadingExisting] = React.useState(false);
    const existingCompetitionIdsRef = React.useRef<Set<string>>(new Set());
    const existingStageIdsRef = React.useRef<Set<string>>(new Set());
    const existingTransitionIdsRef = React.useRef<Set<string>>(new Set());

    React.useEffect(() => {
        if (mode !== 'create') return;
        if (initialCompetitions) return;
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
                const t = await getTournamentForEdit(tournamentId);
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
                ? await updateTournamentDraft(String(tournamentId), {
                    name: general.name,
                    sport: general.sport,
                    venue: general.venue,
                    participantType: general.participantType,
                    inscriptionMode: general.inscriptionMode,
                })
                : await createTournamentDraft({
                    name: general.name,
                    sport: general.sport,
                    venue: general.venue,
                    participantType: general.participantType,
                    inscriptionMode: general.inscriptionMode,
                });

            const competitionIdMap = new Map<string, string>();
            const stageIdMap = new Map<string, string>();
            const existingCompetitionIds = existingCompetitionIdsRef.current;
            const existingStageIds = existingStageIdsRef.current;
            const existingTransitionIds = existingTransitionIdsRef.current;

            // 1) Crear todas las competiciones
            for (let i = 0; i < competitions.length; i++) {
                const comp = competitions[i];
                if (isEdit && existingCompetitionIds.has(comp.id)) {
                    const updatedComp = await updateCompetition(
                        comp.id,
                        comp.name,
                        i + 1,
                        comp.maxSlots ?? null
                    );
                    competitionIdMap.set(comp.id, updatedComp.id);
                } else {
                    const createdComp = await createCompetition(
                        workingTournament.id,
                        comp.name,
                        i + 1,
                        comp.maxSlots ?? null
                    );
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
                        const updatedStage = await updateStage(
                            st.id,
                            st.name,
                            j + 1,
                            format,
                            st.config ?? {},
                            st.children ?? []
                        );
                        stageIdMap.set(st.id, updatedStage.id);
                    } else {
                        const createdStage = await createStage(
                            createdCompetitionId,
                            st.name,
                            j + 1,
                            format,
                            st.config ?? {},
                            st.children ?? []
                        );
                        stageIdMap.set(st.id, createdStage.id);
                        if (format === 'elimination') {
                            const cfg = (st.config as Record<string, unknown>) ?? {};
                            const numParticipants = Number(cfg.numParticipants);
                            if (Number.isInteger(numParticipants) && numParticipants >= 2) {
                                const doubleRound = cfg.matchesPerTie === 'double';
                                await generateEliminationBracket(createdStage.id, doubleRound);
                                const numAdvancing = Number(cfg.numAdvancing);
                                if (Number.isInteger(numAdvancing) && numAdvancing > 1 && numParticipants > numAdvancing) {
                                    const lastRound = Math.round(Math.log2(numParticipants / numAdvancing));
                                    if (lastRound >= 1) {
                                        await trimEliminationBracketAfterRound({
                                            stageId: createdStage.id,
                                            tournamentId: workingTournament.id,
                                            lastRoundInclusive: lastRound,
                                        });
                                    }
                                }
                            }
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
                        await createTransition({
                            from: fromId,
                            to: toId,
                            label: rel.label || 'avance',
                            selectionKind: rel.selection.kind,
                            ...selectionVars,
                            toExternalTournamentId: toId ? null : extTid,
                            toExternalStageId: toId ? null : extSid,
                            toExternalTournamentName: toId ? null : extName,
                            carryOverJson: rel.carryOver ? JSON.stringify(rel.carryOver) : null,
                        });
                    }
                }
            }

            if (isEdit && tournamentId) {
                const tr = await getTournamentForEdit(tournamentId);
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

    function handleCompetitionsChange(next: CompetitionMeta[]) {
        const removed = collectRemovedTransitionIds(competitions, next);
        setCompetitions(next);

        if (mode !== 'edit' || !tournamentId || removed.length === 0) return;

        const toDelete = removed.filter((id) => existingTransitionIdsRef.current.has(id));
        if (toDelete.length === 0) return;

        void (async () => {
            for (const tid of toDelete) {
                try {
                    await deleteTransition(tid);
                    existingTransitionIdsRef.current.delete(tid);
                } catch (err: unknown) {
                    setSubmitState('error');
                    setSubmitMsg(err instanceof Error ? err.message : 'No se pudo eliminar la relación en el servidor');
                    try {
                        const tr = await getTournamentForEdit(tournamentId);
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