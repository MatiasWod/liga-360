import React from 'react';
import type { StageDraft, Relation, Selection, ExternalStageRef, CrossCompetitionOption } from '../StageBuilder';

interface Props {
	stage: StageDraft;
	allStages: StageDraft[];
	lookupStages?: StageDraft[];
	crossOptions?: CrossCompetitionOption[];
	onChange: (id: string, partial: Partial<StageDraft>) => void;
}

const SELECTION_DOT: Record<Selection['kind'], string> = {
	top:    'bg-emerald-400',
	bottom: 'bg-red-400',
	range:  'bg-amber-400',
	bestN:  'bg-sky-400',
};

type FormMode = { kind: 'add' } | { kind: 'edit'; id: string } | null;

function emptyForm() {
	return {
		label: '',
		selectionKind: 'top' as Selection['kind'],
		topCount: 2,
		bottomCount: 2,
		rangeFrom: 3,
		rangeTo: 5,
		bestNCount: 8,
		bestNPosition: 3,
		target: 'internal' as 'internal' | 'cross' | 'external',
		toStageId: '',
		crossCompetitionId: '',
		crossStageId: '',
		externalTournamentId: '',
		externalStageId: '',
	};
}

function formFromRelation(r: Relation) {
	const f = emptyForm();
	f.label = r.label;
	f.selectionKind = r.selection.kind;
	if (r.selection.kind === 'top')    f.topCount = r.selection.count;
	if (r.selection.kind === 'bottom') f.bottomCount = r.selection.count;
	if (r.selection.kind === 'range')  { f.rangeFrom = r.selection.from; f.rangeTo = r.selection.to; }
	if (r.selection.kind === 'bestN')  { f.bestNCount = r.selection.count; f.bestNPosition = r.selection.fromPosition; }
	if (r.toStageId) {
		f.target = 'internal';
		f.toStageId = r.toStageId;
	} else if (r.toExternal?.tournamentId === 'this') {
		f.target = 'cross';
		f.crossCompetitionId = r.toExternal.tournamentName ?? '';
		f.crossStageId = r.toExternal.stageId;
	} else if (r.toExternal) {
		f.target = 'external';
		f.externalTournamentId = r.toExternal.tournamentId;
		f.externalStageId = r.toExternal.stageId;
	}
	return f;
}

export const RelationsEditor: React.FC<Props> = ({ stage, allStages, lookupStages, crossOptions, onChange }) => {
	const destPool = lookupStages ?? allStages;
	const relations = (stage.relations ?? []).filter((r) => r.id !== '__advancing__');

	const [mode, setMode] = React.useState<FormMode>(null);
	const [form, setForm] = React.useState(emptyForm);

	const set = (patch: Partial<ReturnType<typeof emptyForm>>) => setForm((f) => ({ ...f, ...patch }));

	const currentCompetitionId = React.useMemo(
		() => (crossOptions ?? []).find((c) => (c.stages || []).some((s) => s.id === stage.id))?.competitionId,
		[crossOptions, stage.id]
	);

	const crossStages = React.useMemo(
		() => (crossOptions ?? []).find((c) => c.competitionId === form.crossCompetitionId)?.stages ?? [],
		[crossOptions, form.crossCompetitionId]
	);

	React.useEffect(() => {
		if (stage.kind !== 'groups' && form.selectionKind === 'bestN') set({ selectionKind: 'top' });
	}, [stage.kind]);

	function buildSelection(): Selection {
		if (form.selectionKind === 'top')    return { kind: 'top', count: form.topCount };
		if (form.selectionKind === 'bottom') return { kind: 'bottom', count: form.bottomCount };
		if (form.selectionKind === 'bestN')  return { kind: 'bestN', count: form.bestNCount, fromPosition: form.bestNPosition };
		return { kind: 'range', from: form.rangeFrom, to: form.rangeTo };
	}

	function buildRelationBase(): Partial<Relation> | null {
		if (form.target === 'external') {
			if (!form.externalTournamentId || !form.externalStageId) return null;
			return { toExternal: { tournamentId: form.externalTournamentId, stageId: form.externalStageId } as ExternalStageRef };
		}
		if (form.target === 'cross') {
			if (!form.crossStageId) return null;
			return { toExternal: { tournamentId: 'this', stageId: form.crossStageId, tournamentName: form.crossCompetitionId } as ExternalStageRef };
		}
		if (!form.toStageId) return null;
		return { toStageId: form.toStageId };
	}

	function saveRelation() {
		if (!form.label.trim()) return;
		const base = buildRelationBase();
		if (!base) return;
		const selection = buildSelection();
		if (mode?.kind === 'edit') {
			onChange(stage.id, {
				relations: (stage.relations ?? []).map((r) =>
					r.id === mode.id ? { ...r, label: form.label.trim(), selection, ...base, toStageId: undefined, toExternal: undefined, ...base } : r
				),
			});
		} else {
			onChange(stage.id, { relations: [...(stage.relations ?? []), { id: crypto.randomUUID(), label: form.label.trim(), selection, ...base } as Relation] });
		}
		setMode(null);
		setForm(emptyForm());
	}

	function startEdit(r: Relation) {
		setForm(formFromRelation(r));
		setMode({ kind: 'edit', id: r.id });
	}

	function startAdd() {
		setForm(emptyForm());
		setMode({ kind: 'add' });
	}

	function cancel() {
		setMode(null);
		setForm(emptyForm());
	}

	function removeRelation(id: string) {
		onChange(stage.id, { relations: (stage.relations ?? []).filter((r) => r.id !== id) });
		if (mode?.kind === 'edit' && mode.id === id) { setMode(null); setForm(emptyForm()); }
	}

	function resolveDestLabel(r: Relation): string {
		if (r.toExternal) {
			if (r.toExternal.tournamentId === 'this' && r.toExternal.stageId)
				return destPool.find((s) => s.id === r.toExternal?.stageId)?.name ?? r.toExternal.stageName ?? r.toExternal.stageId;
			return r.toExternal.stageName || r.toExternal.stageId;
		}
		return r.toStageId ? (destPool.find((s) => s.id === r.toStageId)?.name ?? '?') : '—';
	}

	const formVisible = mode !== null;
	const isEditing = mode?.kind === 'edit';

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex items-center justify-between">
				<span className="text-xs font-semibold uppercase tracking-wider text-white/40">Relaciones salientes</span>
				{!formVisible && (
					<button type="button" onClick={startAdd}
						className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-white/60 border border-white/10 hover:border-white/20 hover:text-white/90 transition-colors">
						<svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor">
							<path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/>
						</svg>
						Agregar
					</button>
				)}
			</div>

			{/* Lista */}
			{relations.length === 0 && !formVisible
				? <p className="text-xs text-white/25 italic">Sin relaciones definidas</p>
				: (
					<ul className="space-y-1.5">
						{relations.map((r) => {
							const editing = isEditing && mode.kind === 'edit' && mode.id === r.id;
							return (
								<li key={r.id}>
									{editing ? null : (
										<div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
											<span className={`shrink-0 w-2 h-2 rounded-full ${SELECTION_DOT[r.selection.kind]}`} />
											<div className="flex-1 min-w-0 text-xs">
												<span className="font-semibold text-white/85">{r.label}</span>
												<span className="text-white/35 mx-1.5">→</span>
												<span className="text-white/65">{resolveDestLabel(r)}</span>
												<span className="text-white/25 mx-1.5">·</span>
												<span className="text-white/45">{renderSelection(r.selection)}</span>
											</div>
											<button type="button" onClick={() => startEdit(r)}
												className="shrink-0 p-1 rounded text-white/30 hover:text-white/80 hover:bg-white/8 transition-colors"
												aria-label="Editar relación">
												<svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
													<path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81 3.23 11.33c-.03.03-.05.064-.06.1l-.635 2.222 2.222-.635a.25.25 0 00.1-.06l6.532-6.507z"/>
												</svg>
											</button>
											<button type="button" onClick={() => removeRelation(r.id)}
												className="shrink-0 p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
												aria-label="Eliminar relación">
												<svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
													<path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 000 1.5h.3l.815 8.15A1.5 1.5 0 005.357 15h5.285a1.5 1.5 0 001.493-1.35l.815-8.15h.3a.75.75 0 000-1.5H11v-.75A2.25 2.25 0 008.75 1h-1.5A2.25 2.25 0 005 3.25zm2.25-.75a.75.75 0 00-.75.75V4h3v-.75a.75.75 0 00-.75-.75h-1.5zM6.05 6a.75.75 0 01.787.713l.275 5.5a.75.75 0 01-1.498.075l-.275-5.5A.75.75 0 016.05 6zm3.9 0a.75.75 0 01.712.787l-.275 5.5a.75.75 0 01-1.498-.075l.275-5.5a.75.75 0 01.786-.712z" clipRule="evenodd"/>
												</svg>
											</button>
										</div>
									)}
								</li>
							);
						})}
					</ul>
				)
			}

			{/* Formulario agregar / editar */}
			{formVisible && (
				<div className="rounded-xl border border-white/12 bg-white/4 p-3 space-y-3">
					<div className="text-xs font-medium text-white/50">{isEditing ? 'Editar relación' : 'Nueva relación'}</div>

					{/* Fila 1: Nombre + Selección */}
					<div className="flex flex-wrap gap-2">
						<input value={form.label} onChange={(e) => set({ label: e.target.value })}
							placeholder="Nombre (ej: Avance, Descenso)"
							className="flex-1 min-w-32 rounded-lg bg-white/8 border border-white/10 px-3 py-1.5 text-xs outline-none focus:border-white/25 placeholder-white/25" />
						<div className="flex items-center gap-1.5 flex-wrap">
							<select value={form.selectionKind} onChange={(e) => set({ selectionKind: e.target.value as Selection['kind'] })}
								className="rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-white/25">
								<option value="top">Primeros</option>
								<option value="bottom">Últimos</option>
								<option value="range">Puestos</option>
								{stage.kind === 'groups' && <option value="bestN">Mejores N del puesto M</option>}
							</select>
							{form.selectionKind === 'top' && (
								<input type="number" min={1} value={form.topCount} onChange={(e) => set({ topCount: parseInt(e.target.value || '1') })}
									className="w-14 rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs text-center outline-none focus:border-white/25" placeholder="N" />
							)}
							{form.selectionKind === 'bottom' && (
								<input type="number" min={1} value={form.bottomCount} onChange={(e) => set({ bottomCount: parseInt(e.target.value || '1') })}
									className="w-14 rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs text-center outline-none focus:border-white/25" placeholder="N" />
							)}
							{form.selectionKind === 'range' && (
								<>
									<input type="number" min={1} value={form.rangeFrom} onChange={(e) => set({ rangeFrom: parseInt(e.target.value || '1') })}
										className="w-14 rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs text-center outline-none focus:border-white/25" placeholder="Desde" />
									<span className="text-white/30 text-xs">a</span>
									<input type="number" min={1} value={form.rangeTo} onChange={(e) => set({ rangeTo: parseInt(e.target.value || '1') })}
										className="w-14 rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs text-center outline-none focus:border-white/25" placeholder="Hasta" />
								</>
							)}
							{form.selectionKind === 'bestN' && (
								<>
									<input type="number" min={1} value={form.bestNCount} onChange={(e) => set({ bestNCount: parseInt(e.target.value || '1') })}
										className="w-14 rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs text-center outline-none focus:border-white/25" placeholder="N" />
									<span className="text-white/30 text-xs shrink-0">del puesto</span>
									<input type="number" min={1} value={form.bestNPosition} onChange={(e) => set({ bestNPosition: parseInt(e.target.value || '1') })}
										className="w-14 rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs text-center outline-none focus:border-white/25" placeholder="M" />
								</>
							)}
						</div>
					</div>

					{/* Fila 2: Destino */}
					<div className="flex flex-wrap gap-2 items-center">
						<span className="text-xs text-white/40 shrink-0">→</span>
						<select value={form.target}
							onChange={(e) => set({ target: e.target.value as typeof form.target, toStageId: '', crossCompetitionId: '', crossStageId: '', externalTournamentId: '', externalStageId: '' })}
							className="rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-white/25">
							<option value="internal">Mis etapas</option>
							<option value="cross">Otra competencia</option>
							<option value="external">Otro torneo</option>
						</select>
						{form.target === 'internal' && (
							<select value={form.toStageId} onChange={(e) => set({ toStageId: e.target.value })}
								className="flex-1 rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-white/25">
								<option value="">Seleccionar etapa…</option>
								{allStages.filter((s) => s.id !== stage.id).map((s) => (
									<option key={s.id} value={s.id}>{s.name}</option>
								))}
							</select>
						)}
						{form.target === 'cross' && (
							<>
								<select value={form.crossCompetitionId}
									onChange={(e) => set({ crossCompetitionId: e.target.value, crossStageId: '' })}
									className="rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-white/25">
									<option value="">Competencia…</option>
									{(crossOptions ?? []).filter((c) => c.competitionId !== currentCompetitionId).map((c) => (
										<option key={c.competitionId} value={c.competitionId}>{c.competitionName}</option>
									))}
								</select>
								<select value={form.crossStageId} onChange={(e) => set({ crossStageId: e.target.value })}
									className="flex-1 rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-white/25">
									<option value="">Etapa…</option>
									{crossStages.map((s) => (
										<option key={s.id} value={s.id}>{s.name}</option>
									))}
								</select>
							</>
						)}
						{form.target === 'external' && (
							<>
								<input value={form.externalTournamentId} onChange={(e) => set({ externalTournamentId: e.target.value })}
									placeholder="ID torneo destino"
									className="flex-1 rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-white/25" />
								<input value={form.externalStageId} onChange={(e) => set({ externalStageId: e.target.value })}
									placeholder="ID etapa destino"
									className="flex-1 rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-white/25" />
							</>
						)}
					</div>

					{/* Acciones */}
					<div className="flex justify-end gap-2 pt-1">
						<button type="button" onClick={cancel}
							className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:text-white/80 transition-colors">
							Cancelar
						</button>
						<button type="button" onClick={saveRelation}
							className="rounded-lg bg-accent-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors">
							{isEditing ? 'Guardar cambios' : 'Agregar relación'}
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

function renderSelection(sel: Selection): string {
	if (sel.kind === 'top')    return `Primeros ${sel.count}`;
	if (sel.kind === 'bottom') return `Últimos ${sel.count}`;
	if (sel.kind === 'bestN')  return `Mejores ${sel.count} del puesto ${sel.fromPosition}`;
	return `Puestos ${sel.from}–${sel.to}`;
}
