import React from 'react';
import type { StageDraft, Relation, Selection, ExternalStageRef, CrossCompetitionOption } from '../StageBuilder';

interface Props {
	stage: StageDraft;
	allStages: StageDraft[];
	crossOptions?: CrossCompetitionOption[];
	onChange: (id: string, partial: Partial<StageDraft>) => void;
}

export const RelationsEditor: React.FC<Props> = ({ stage, allStages, crossOptions, onChange }) => {
	const relations = stage.relations ?? [];

	const [label, setLabel] = React.useState('');
	const [toStageId, setToStageId] = React.useState('');
	// destino
	const [target, setTarget] = React.useState<'internal' | 'cross' | 'external'>('internal');
	const [externalTournamentId, setExternalTournamentId] = React.useState('');
	const [externalStageId, setExternalStageId] = React.useState('');
	const [crossCompetitionId, setCrossCompetitionId] = React.useState('');
	const [crossStageId, setCrossStageId] = React.useState('');
	const [selectionKind, setSelectionKind] = React.useState<Selection['kind']>('top');
	const [topCount, setTopCount] = React.useState(2);
	const [rangeFrom, setRangeFrom] = React.useState(3);
	const [rangeTo, setRangeTo] = React.useState(5);
	const [bottomCount, setBottomCount] = React.useState(2);

	// carryOver: desactivado por ahora

	function buildSelection(): Selection {
		if (selectionKind === 'top') return { kind: 'top', count: topCount };
		if (selectionKind === 'bottom') return { kind: 'bottom', count: bottomCount };
		return { kind: 'range', from: rangeFrom, to: rangeTo };
	}

	// buildCarryOver eliminado (no se usa)

	function addRelation() {
		if (!label.trim()) return;
		const base: Omit<Relation,'id'|'label'|'selection'> & { selection?: never } = {} as any;
		if (target === 'external') {
			if (!externalTournamentId || !externalStageId) return;
			(Object.assign(base, { toExternal: { tournamentId: externalTournamentId, stageId: externalStageId } as ExternalStageRef }));
		} else if (target === 'cross') {
			if (!crossStageId) return;
			// Representamos cruzado como externo dentro del mismo torneo pero con un namespace de competencia
			(Object.assign(base, { toExternal: { tournamentId: `this`, stageId: crossStageId, tournamentName: crossCompetitionId } as ExternalStageRef }));
		} else { // internal
			if (!toStageId) return;
			(Object.assign(base, { toStageId }));
		}
		const rel: Relation = {
			id: crypto.randomUUID(),
			label: label.trim(),
			selection: buildSelection(),
			...(base as any)
		};
		onChange(stage.id, { relations: [...relations, rel] });
		setLabel('');
	}

	function removeRelation(id: string) {
		onChange(stage.id, { relations: relations.filter((r) => r.id !== id) });
	}

	const crossStages = React.useMemo(() => {
		const comp = crossOptions?.find((c) => c.competitionId === crossCompetitionId);
		return comp?.stages ?? [];
	}, [crossOptions, crossCompetitionId]);

	// Competencia actual: la que contiene a esta stage
	const currentCompetitionId = React.useMemo(() => {
		const found = (crossOptions ?? []).find((c) => (c.stages || []).some((s) => s.id === stage.id));
		return found?.competitionId;
	}, [crossOptions, stage.id]);

	React.useEffect(() => {
		// Reset campos al cambiar destino
		setToStageId('');
		setCrossCompetitionId('');
		setCrossStageId('');
		setExternalTournamentId('');
		setExternalStageId('');
	}, [target]);

	React.useEffect(() => {
		// Si por algún motivo quedó seleccionada la misma competencia, limpiar
		if (crossCompetitionId && crossCompetitionId === currentCompetitionId) {
			setCrossCompetitionId('');
			setCrossStageId('');
		}
	}, [crossCompetitionId, currentCompetitionId]);

	// Efectos de arrastre eliminados

	return (
		<div className="space-y-3">
			<ul className="space-y-2">
				{relations.map((r) => {
					const to = r.toStageId ? allStages.find((s) => s.id === r.toStageId) : undefined;
					const destLabel = r.toExternal ? (r.toExternal.stageName || r.toExternal.stageId) : (to?.name ?? '—');
					return (
						<li key={r.id} className="flex items-start justify-between gap-2 rounded bg-white/5 border border-white/10 p-2">
							<div className="text-sm">
								<span className="opacity-80">{r.label}</span> → <strong>{destLabel}</strong> · {renderSelection(r.selection)}
							</div>
							<button type="button" onClick={() => removeRelation(r.id)} className="text-xs opacity-80 hover:opacity-100">Eliminar</button>
						</li>
					);
				})}
			</ul>
			<div className="flex flex-col gap-3 rounded border border-white/10 p-3">
				<div className="text-sm font-medium opacity-90">Agregar relación</div>

				{/* Nombre y Selección */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
					<label className="flex flex-col gap-1">
						<span className="text-xs opacity-80">Nombre de la relación</span>
						<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: avance, ascenso, descenso, clasificación" className="rounded bg-white/10 border border-white/10 px-3 py-2" />
					</label>
					<label className="flex flex-col gap-1">
						<span className="text-xs opacity-80">Aplica a:</span>
						<select value={selectionKind} onChange={(e) => setSelectionKind(e.target.value as Selection['kind'])} className="rounded bg-white/10 border border-white/10 px-2 py-2">
							<option value="top">Primeros N puestos</option>
							<option value="range">Puestos entre</option>
							<option value="bottom">Últimos N puestos</option>
						</select>
						{/* Cantidad/intervalo debajo de la selección */}
						{selectionKind === 'top' && (
							<div className="mt-2">
								<input
									type="number"
									min={1}
									value={topCount}
									onChange={(e) => setTopCount(parseInt(e.target.value || '1'))}
									className="w-full rounded bg-white/10 border border-white/10 px-3 py-2"
									placeholder="Cantidad (N)"
								/>
							</div>
						)}
						{selectionKind === 'bottom' && (
							<div className="mt-2">
								<input
									type="number"
									min={1}
									value={bottomCount}
									onChange={(e) => setBottomCount(parseInt(e.target.value || '1'))}
									className="w-full rounded bg-white/10 border border-white/10 px-3 py-2"
									placeholder="Cantidad (N)"
								/>
							</div>
						)}
						{selectionKind === 'range' && (
							<div className="mt-2 grid grid-cols-2 gap-2">
								<input
									type="number"
									min={1}
									value={rangeFrom}
									onChange={(e) => setRangeFrom(parseInt(e.target.value || '1'))}
									className="rounded bg-white/10 border border-white/10 px-3 py-2"
									placeholder="Desde"
								/>
								<input
									type="number"
									min={1}
									value={rangeTo}
									onChange={(e) => setRangeTo(parseInt(e.target.value || '1'))}
									className="rounded bg-white/10 border border-white/10 px-3 py-2"
									placeholder="Hasta"
								/>
							</div>
						)}
					</label>
				</div>

				{/* Destino: selector de tipo */}
				<div className="flex flex-col gap-2">
					<div className="text-xs opacity-80">Destino</div>
					<div className="inline-flex rounded-lg border border-brand-greenDark/40 bg-brand-greenDark/20 p-1 text-xs w-fit">
						<button type="button" onClick={() => setTarget('internal')} className={`px-3 py-1 rounded-md ${target === 'internal' ? 'bg-brand-green text-white' : 'hover:bg-brand-green/20'}`}>Mis etapas</button>
						<button type="button" onClick={() => setTarget('cross')} className={`px-3 py-1 rounded-md ${target === 'cross' ? 'bg-brand-green text-white' : 'hover:bg-brand-green/20'}`}>Otra competencia</button>
						<button type="button" onClick={() => setTarget('external')} className={`px-3 py-1 rounded-md ${target === 'external' ? 'bg-brand-green text-white' : 'hover:bg-brand-green/20'}`}>Otro torneo</button>
					</div>
				</div>

				{/* Campos según destino */}
				{target === 'internal' && (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
						<label className="flex flex-col gap-1">
							<span className="text-xs opacity-80">Destino (mis etapas)</span>
							<select value={toStageId} onChange={(e) => setToStageId(e.target.value)} className="rounded bg-white/10 border border-white/10 px-2 py-2">
								<option value="">Seleccionar etapa…</option>
								{allStages.filter((s) => s.id !== stage.id).map((s) => (
									<option key={s.id} value={s.id}>{s.name}</option>
								))}
							</select>
						</label>
					</div>
				)}

				{target === 'cross' && (
					<div className="grid grid-cols-1 md:grid-cols-4 gap-2">
						<label className="flex flex-col gap-1">
							<span className="text-xs opacity-80">Otra competencia</span>
							<select value={crossCompetitionId} onChange={(e) => { setCrossCompetitionId(e.target.value); setCrossStageId(''); }} className="rounded bg-white/10 border border-white/10 px-2 py-2">
								<option value="">Seleccionar competencia…</option>
								{(crossOptions ?? []).filter((c) => c.competitionId !== currentCompetitionId).map((c) => (
									<option key={c.competitionId} value={c.competitionId}>{c.competitionName}</option>
								))}
							</select>
						</label>
						<label className="flex flex-col gap-1 md:col-span-2">
							<span className="text-xs opacity-80">Etapa destino</span>
							<select value={crossStageId} onChange={(e) => setCrossStageId(e.target.value)} className="rounded bg-white/10 border border-white/10 px-2 py-2">
								<option value="">Seleccionar etapa…</option>
								{crossStages.map((s) => (
									<option key={s.id} value={s.id}>{s.name}</option>
								))}
							</select>
						</label>
						<div className="text-xs opacity-70 self-end">Relación entre competiciones del mismo torneo.</div>
					</div>
				)}

				{target === 'external' && (
					<div className="grid grid-cols-1 md:grid-cols-4 gap-2">
						<label className="flex flex-col gap-1">
							<span className="text-xs opacity-80">Tournament ID destino</span>
							<input value={externalTournamentId} onChange={(e) => setExternalTournamentId(e.target.value)} placeholder="ID de torneo" className="rounded bg-white/10 border border-white/10 px-3 py-2" />
						</label>
						<label className="flex flex-col gap-1">
							<span className="text-xs opacity-80">Stage ID destino</span>
							<input value={externalStageId} onChange={(e) => setExternalStageId(e.target.value)} placeholder="ID de etapa" className="rounded bg-white/10 border border-white/10 px-3 py-2" />
						</label>
						<div className="md:col-span-2 text-xs opacity-70 self-end">Por ahora por ID; más adelante agregamos buscador.</div>
					</div>
				)}

				{/* (los campos de cantidad se muestran debajo del selector "Aplica a") */}

				{/* Configuración de arrastre removida temporalmente */}

				<div className="text-right">
					<button type="button" onClick={addRelation} className="btn-primary">Agregar</button>
				</div>
			</div>
		</div>
	);
};

function renderSelection(sel: Selection) {
	if (sel.kind === 'top') return `Primeros ${sel.count}`;
	if (sel.kind === 'bottom') return `Últimos ${sel.count}`;
	return `Puestos ${sel.from} a ${sel.to}`;
} 