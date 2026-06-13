import React from 'react';
import { Section } from './atoms/Section';
import { TextField } from './atoms/TextField';
import { SelectField } from './atoms/SelectField';
import { CompetitionsBuilder, type CompetitionMeta } from './CompetitionsBuilder';
import { CategoryLabelChips } from './CategoryLabelChips';
import { SeriesSelectField } from './SeriesSelectField';
import {
    collectRemovedTransitionIds,
    deriveFormStateFromGraphqlTournament,
} from '../services/tournamentMapping';
import {
    createTournamentDraft,
    deleteTransition,
    getTournamentForEdit,
    updateTournamentDraft,
} from '../services/tournamentStructureApi';
import { persistTournamentStructure } from '../services/persistTournamentStructure';
import {
    normalizeCategoryLabelInput,
    resolveCategoryLabelsForCreate,
} from '../utils/categoryLabel';
import { listOrganizerSeries, type CompetitionSeries } from '../../../services/tournaments/series';

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
    type TournamentStatus = 'draft' | 'published' | 'finished';

    interface GeneralInfo {
        name: string;
        sport: string;
        venue: string;
        participantType: ParticipantType;
        inscriptionMode: InscriptionMode;
        status: TournamentStatus;
        seriesId: string;
        editionLabel: string;
        categoryLabel: string;
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
        status: 'draft',
        seriesId: '',
        editionLabel: '',
        categoryLabel: '',
    });
    const [categoryLabelsChips, setCategoryLabelsChips] = React.useState<string[]>([]);
    const [seriesOptions, setSeriesOptions] = React.useState<CompetitionSeries[]>([]);
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
            const parsed = JSON.parse(raw) as { general?: GeneralInfo; competitions?: CompetitionMeta[]; categoryLabelsChips?: string[] };
            if (parsed?.general) setGeneral(parsed.general);
            if (parsed?.competitions && parsed.competitions.length > 0) setCompetitions(parsed.competitions);
            if (Array.isArray(parsed?.categoryLabelsChips)) setCategoryLabelsChips(parsed.categoryLabelsChips);
        } catch {}
    }, [mode]);

    React.useEffect(() => {
        let cancelled = false;
        listOrganizerSeries()
            .then((rows) => {
                if (!cancelled) setSeriesOptions(rows);
            })
            .catch(() => {
                if (!cancelled) setSeriesOptions([]);
            });
        return () => {
            cancelled = true;
        };
    }, [organizerName]);

    React.useEffect(() => {
        if (mode !== 'create') return;
        try {
            const payload = JSON.stringify({ general, competitions, categoryLabelsChips });
            localStorage.setItem(STORAGE_KEY, payload);
        } catch {}
    }, [general, competitions, categoryLabelsChips, mode]);

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
                    seriesId: derived.general.seriesId || '',
                    editionLabel: derived.general.editionLabel || '',
                    categoryLabel: derived.general.categoryLabel || '',
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
            const editCategoryLabel = isEdit
                ? normalizeCategoryLabelInput(general.categoryLabel)
                : null;

            if (isEdit) {
                const workingTournament = await updateTournamentDraft(String(tournamentId), {
                    name: general.name,
                    sport: general.sport,
                    venue: general.venue,
                    participantType: general.participantType,
                    inscriptionMode: general.inscriptionMode,
                    status: general.status,
                    seriesId: general.seriesId || null,
                    editionLabel: general.editionLabel || null,
                    categoryLabel: editCategoryLabel,
                });

                await persistTournamentStructure({
                    tournamentId: workingTournament.id,
                    competitions,
                    isEdit: true,
                    existingCompetitionIds: existingCompetitionIdsRef.current,
                    existingStageIds: existingStageIdsRef.current,
                    existingTransitionIds: existingTransitionIdsRef.current,
                });

                const tr = await getTournamentForEdit(String(tournamentId));
                if (tr) {
                    const derived = deriveFormStateFromGraphqlTournament(tr);
                    setGeneral({
                        ...derived.general,
                        participantType: derived.general.participantType as ParticipantType,
                        inscriptionMode: derived.general.inscriptionMode as InscriptionMode,
                        seriesId: derived.general.seriesId || '',
                        editionLabel: derived.general.editionLabel || '',
                        categoryLabel: derived.general.categoryLabel || '',
                    });
                    setCompetitions(derived.competitions);
                    existingCompetitionIdsRef.current = derived.existingCompetitionIds;
                    existingStageIdsRef.current = derived.existingStageIds;
                    existingTransitionIdsRef.current = derived.existingTransitionIds;
                }

                setSubmitState('success');
                setSubmitMsg(`Estructura actualizada. Torneo: ${workingTournament.id}`);
                onUpdated?.({ id: workingTournament.id, name: workingTournament.name });
                return;
            }

            const labels = resolveCategoryLabelsForCreate(categoryLabelsChips);
            const createdTournaments: Array<{ id: string; name: string; categoryLabel?: string | null }> = [];

            for (const categoryLabel of labels) {
                const workingTournament = await createTournamentDraft({
                    name: general.name,
                    sport: general.sport,
                    venue: general.venue,
                    participantType: general.participantType,
                    inscriptionMode: general.inscriptionMode,
                    seriesId: general.seriesId || null,
                    editionLabel: general.editionLabel || null,
                    categoryLabel,
                });

                await persistTournamentStructure({
                    tournamentId: workingTournament.id,
                    competitions,
                    isEdit: false,
                });

                createdTournaments.push({
                    id: workingTournament.id,
                    name: workingTournament.name,
                    categoryLabel,
                });
            }

            setSubmitState('success');
            if (createdTournaments.length === 1) {
                setSubmitMsg(`Estructura creada. Torneo: ${createdTournaments[0].id}`);
            } else {
                const summary = createdTournaments
                    .map((row) => (row.categoryLabel ? `${row.categoryLabel} (${row.id})` : row.id))
                    .join(', ');
                setSubmitMsg(`Se crearon ${createdTournaments.length} torneos: ${summary}`);
            }
            onCreated?.({ id: createdTournaments[0].id, name: createdTournaments[0].name });
        } catch (err: any) {
            setSubmitState('error');
            setSubmitMsg(err?.message || 'Error inesperado');
        }
    }

    function onSaveDraft() {
        if (mode !== 'create') return;
        try {
            const payload = JSON.stringify({ general, competitions, categoryLabelsChips });
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
                                seriesId: derived.general.seriesId || '',
                                editionLabel: derived.general.editionLabel || '',
                                categoryLabel: derived.general.categoryLabel || '',
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
            {loadingExisting ? <div className="text-sm opacity-70">Cargando estructura existente...</div> : null}
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
                        <span className="text-sm font-medium opacity-90">Organizador</span>
                        <p className="text-sm font-semibold opacity-95">
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
                    <SeriesSelectField
                        label="Serie de competición (opcional)"
                        value={general.seriesId}
                        sport={general.sport}
                        seriesOptions={seriesOptions}
                        onChange={(seriesId) => setGeneral((g) => ({ ...g, seriesId: seriesId || '' }))}
                        onSeriesOptionsChange={setSeriesOptions}
                    />
                    <TextField
                        label="Etiqueta de edición"
                        placeholder='Ej: "2022"'
                        name="editionLabel"
                        value={general.editionLabel}
                        onChange={(e) => {
                            const target = e?.currentTarget;
                            if (!target) return;
                            setGeneral((g) => ({ ...g, editionLabel: target.value ?? '' }));
                        }}
                    />
                    {mode === 'create' ? (
                        <CategoryLabelChips value={categoryLabelsChips} onChange={setCategoryLabelsChips} />
                    ) : (
                        <TextField
                            label="Etiqueta de categoría (opcional)"
                            placeholder='Ej: "Femenino", "Sub-23"'
                            name="categoryLabel"
                            value={general.categoryLabel}
                            onChange={(e) => {
                                const target = e?.currentTarget;
                                if (!target) return;
                                setGeneral((g) => ({ ...g, categoryLabel: target.value ?? '' }));
                            }}
                        />
                    )}
                    {mode === 'edit' && (
                        <SelectField
                            label="Estado del torneo"
                            name="status"
                            value={general.status}
                            onChange={(value) => {
                                const v = (value || 'draft') as TournamentStatus;
                                setGeneral((g) => ({ ...g, status: v }));
                            }}
                            options={[
                                { label: 'Borrador', value: 'draft' },
                                { label: 'Publicado', value: 'published' },
                                { label: 'Finalizado', value: 'finished' },
                            ]}
                        />
                    )}
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