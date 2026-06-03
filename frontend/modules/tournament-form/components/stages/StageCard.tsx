import React from 'react';
import type { StageDraft, StageKind, Selection, CrossCompetitionOption } from './StageBuilder';
import { RelationsEditor } from './relations/RelationsEditor';
import { TieBreakEditor, RuleItem } from './tiebreak/TieBreakEditor';

interface StageCardProps {
	stage: StageDraft;
	allStages: StageDraft[];
	/** Todas las etapas del torneo (nombres de destino e inbound cruzado). Si no se pasa, se usa solo `allStages`. */
	lookupStages?: StageDraft[];
	crossOptions?: CrossCompetitionOption[];
	onChange: (id: string, partial: Partial<StageDraft>) => void;
	onRemove: (id: string) => void;
}

export const StageCard: React.FC<StageCardProps> = ({ stage, allStages, lookupStages, crossOptions, onChange, onRemove }) => {
	const inboundPool = lookupStages ?? allStages;
	const [tab, setTab] = React.useState<'details' | 'tiebreak'>('details');
	const [confirmDelete, setConfirmDelete] = React.useState(false);

	return (
		<div className="card p-4">
			{/* Header */}
			<div className="flex items-start gap-3">
				<KindIcon kind={stage.kind} />
				<div className="flex-1 min-w-0">
					<input
						value={stage.name}
						onChange={(e) => onChange(stage.id, { name: e.target.value })}
						className="w-full text-base font-semibold bg-transparent outline-none border-b border-transparent focus:border-white/30 truncate"
					/>
					<TypeBadge kind={stage.kind} />
				</div>
				<div className="shrink-0">
					{confirmDelete ? (
						<div className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1">
							<span className="text-xs text-red-300">¿Eliminar?</span>
							<button
								type="button"
								onClick={() => onRemove(stage.id)}
								className="text-xs font-semibold text-red-300 hover:text-red-200"
							>Sí</button>
							<span className="text-red-500/50 text-xs">·</span>
							<button
								type="button"
								onClick={() => setConfirmDelete(false)}
								className="text-xs text-white/50 hover:text-white/80"
							>No</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setConfirmDelete(true)}
							className="rounded-lg p-1.5 text-white/30 hover:bg-red-500/15 hover:text-red-400 transition-colors"
							title="Eliminar etapa"
						>
							<svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
								<path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
							</svg>
						</button>
					)}
				</div>
			</div>

			{/* Tabs + content */}
			<div className="mt-4">
				<Tabs tab={tab} setTab={setTab} />
				<div className="mt-3">
					{tab === 'details' && (
						<StageConfig
							kind={stage.kind}
							stage={stage}
							allStages={allStages}
							inboundStages={inboundPool}
							lookupStages={lookupStages}
							crossOptions={crossOptions}
							onChange={onChange}
						/>
					)}
					{tab === 'tiebreak' && (
						<TieBreakEditor value={stage.config?.tiebreak as RuleItem[] | undefined} onChange={(rules) => onChange(stage.id, { config: { ...stage.config, tiebreak: rules } })} />
					)}
				</div>
			</div>
		</div>
	);
};

function Tabs({ tab, setTab }: { tab: 'details' | 'tiebreak'; setTab: (t: 'details' | 'tiebreak') => void; }) {
	return (
		<div className="inline-flex rounded-lg border border-brand-greenDark/40 bg-brand-greenDark/20 p-1 text-xs">
			<button type="button" onClick={() => setTab('details')} className={`px-3 py-1 rounded-md ${tab === 'details' ? 'bg-brand-green text-white' : 'hover:bg-brand-green/20'}`}>Detalles</button>
			<button type="button" onClick={() => setTab('tiebreak')} className={`px-3 py-1 rounded-md ${tab === 'tiebreak' ? 'bg-brand-green text-white' : 'hover:bg-brand-green/20'}`}>Desempate</button>
		</div>
	);
}

function KindIcon({ kind }: { kind: StageKind }) {
	const styles: Record<StageKind, string> = {
		groups:   'bg-sky-500/15 text-sky-400',
		league:   'bg-emerald-500/15 text-emerald-400',
		knockout: 'bg-amber-500/15 text-amber-400',
		composed: 'bg-fuchsia-500/15 text-fuchsia-400',
	};
	return (
		<div className={`shrink-0 flex items-center justify-center rounded-xl w-10 h-10 ${styles[kind]}`}>
			{kind === 'groups' && (
				<svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
					<path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" />
				</svg>
			)}
			{kind === 'league' && (
				<svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
					<path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
				</svg>
			)}
			{kind === 'knockout' && (
				<svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
					<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
				</svg>
			)}
			{kind === 'composed' && (
				<svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
					<path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
				</svg>
			)}
		</div>
	);
}

function TypeBadge({ kind }: { kind: StageKind }) {
	const labelMap: Record<StageKind, string> = {
		groups:   'Grupos',
		league:   'Liga',
		knockout: 'Eliminación directa',
		composed: 'Compuesta',
	};
	const colorMap: Record<StageKind, string> = {
		groups:   'text-sky-400',
		league:   'text-emerald-400',
		knockout: 'text-amber-400',
		composed: 'text-fuchsia-400',
	};
	return <span className={`text-[11px] font-medium ${colorMap[kind]}`}>{labelMap[kind]}</span>;
}

function FieldRow({ label, children, hint }: React.PropsWithChildren<{ label: string; hint?: string }>) {
	return (
		<div>
			<label className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 py-2">
				<span className="text-sm opacity-80">{label}</span>
				<div className="md:col-span-2">{children}</div>
			</label>
			{hint && <div className="text-[11px] opacity-70 md:pl-[calc(33%+0.5rem)] -mt-1.5 mb-2">{hint}</div>}
		</div>
	);
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
	return <input {...props} className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-green/60" />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
	return <select {...props} className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-green/60" />;
}

function StageConfig({
	kind,
	stage,
	allStages,
	inboundStages,
	lookupStages,
	crossOptions,
	onChange,
}: {
	kind: StageKind;
	stage: StageDraft;
	allStages: StageDraft[];
	inboundStages: StageDraft[];
	lookupStages?: StageDraft[];
	crossOptions?: CrossCompetitionOption[];
	onChange: (id: string, partial: Partial<StageDraft>) => void;
}) {
	const cfg = (stage.config || {}) as any;
	const inbound = computeInbound(stage.id, inboundStages);
	const inboundTotal = inbound.reduce((sum, i) => sum + i.count, 0);
	switch (kind) {
		case 'groups': {
			const groups = cfg.numGroups as number | undefined;
			const per = cfg.teamsPerGroup as number | undefined;
			const product = groups && per ? groups * per : undefined;
			const hint = inboundTotal > 0 ? `Sugerencia: ${inboundTotal} equipos provienen de ${inbound.map(i => `${i.count} (${i.label}) de ${i.from}`).join(', ')}` : undefined;
			const warn = product && inboundTotal && product !== inboundTotal ? `Aviso: ${product} ≠ ${inboundTotal} (provenientes).` : undefined;
			return (
				<div className="space-y-2">
					<FieldRow label="Cantidad de grupos" hint={hint}>
						<Input type="number" min={1} value={cfg.numGroups ?? ''} onChange={(e) => onChange(stage.id, { config: { ...cfg, numGroups: parseInt(e.target.value || '0') } })} placeholder="Ej: 5" />
					</FieldRow>
					<FieldRow label="Equipos por grupo" hint={warn}>
						<Input type="number" min={1} value={cfg.teamsPerGroup ?? ''} onChange={(e) => onChange(stage.id, { config: { ...cfg, teamsPerGroup: parseInt(e.target.value || '0') } })} placeholder="Ej: 7" />
					</FieldRow>
					<FieldRow label="Rondas">
						<Select value={cfg.groupRoundType ?? 'single'} onChange={(e) => onChange(stage.id, { config: { ...cfg, groupRoundType: e.target.value } })}>
							<option value="single">Solo ida</option>
							<option value="double">Ida y vuelta</option>
						</Select>
					</FieldRow>
					<div className="pt-2 border-t border-white/10">
						<RelationsEditor stage={stage} allStages={allStages} lookupStages={lookupStages} crossOptions={crossOptions} onChange={onChange} />
					</div>
				</div>
			);
		}
		case 'league': {
			const suggested = inboundTotal || undefined;
			const maxRoundsVal = cfg.maxRounds != null ? String(cfg.maxRounds) : '';
			return (
				<div className="space-y-2">
					<FieldRow label="Participantes" hint={suggested ? `Sugerencia: ${suggested} provenientes de ${inbound.map(i => `${i.from} (${i.count})`).join(', ')}` : undefined}>
						<Input type="number" min={2} value={cfg.numParticipants ?? (suggested ?? '')} onChange={(e) => onChange(stage.id, { config: { ...cfg, numParticipants: parseInt(e.target.value || '0') } })} placeholder="Ej: 20" />
					</FieldRow>
					<FieldRow label="Formato">
						<Select value={cfg.rounds ?? 'single'} onChange={(e) => onChange(stage.id, { config: { ...cfg, rounds: e.target.value } })}>
							<option value="single">Solo ida</option>
							<option value="double">Ida y vuelta</option>
						</Select>
					</FieldRow>
					<FieldRow label="Fechas máximas" hint="Opcional. Limita las fechas generadas (ej: 8 para formato Swiss).">
						<Input
							type="number"
							min={1}
							value={maxRoundsVal}
							onChange={(e) => {
								const v = e.target.value;
								onChange(stage.id, { config: { ...cfg, maxRounds: v === '' ? undefined : parseInt(v) } });
							}}
							placeholder="Todas (round-robin completo)"
						/>
					</FieldRow>
					<div className="pt-2 border-t border-white/10">
						<RelationsEditor stage={stage} allStages={allStages} lookupStages={lookupStages} crossOptions={crossOptions} onChange={onChange} />
					</div>
				</div>
			);
		}
		case 'knockout': {
			const numParticipants = Number(cfg.numParticipants) || 0;
			const numAdvancing = Number(cfg.numAdvancing) || 1;
			const suggested = inboundTotal || undefined;
			const advancingOptions = buildAdvancingOptions(numParticipants);
			const advancingToStageId = (stage.relations ?? []).find((r) => r.id === '__advancing__')?.toStageId ?? '';

			function handleNumParticipantsChange(raw: string) {
				const n = parseInt(raw || '0');
				const newCfg: Record<string, unknown> = { ...cfg, numParticipants: n };
				// Reset numAdvancing if it's no longer valid for the new participant count
				const opts = buildAdvancingOptions(n);
				if (opts.length > 0 && !opts.some((o) => o.value === numAdvancing)) {
					newCfg.numAdvancing = 1;
				}
				onChange(stage.id, { config: newCfg });
			}

			function handleNumAdvancingChange(newAdv: number) {
				const newCfg: Record<string, unknown> = { ...cfg, numAdvancing: newAdv };
				if (newAdv > 1) newCfg.thirdPlace = 'no';
				const newRelations = syncAdvancingRelation(stage.relations ?? [], newAdv, advancingToStageId || undefined);
				onChange(stage.id, { config: newCfg, relations: newRelations });
			}

			function handleDestinationChange(toStageId: string) {
				const newRelations = syncAdvancingRelation(stage.relations ?? [], numAdvancing, toStageId || undefined);
				onChange(stage.id, { relations: newRelations });
			}

			return (
				<div className="space-y-2">
					<FieldRow label="Participantes" hint={suggested ? `Sugerencia: ${suggested} provenientes de ${inbound.map(i => `${i.from} (${i.count})`).join(', ')}` : undefined}>
						<Input type="number" min={2} value={cfg.numParticipants ?? (suggested ?? '')} onChange={(e) => handleNumParticipantsChange(e.target.value)} placeholder="Ej: 16" />
					</FieldRow>
					<FieldRow label="Partidos por llave">
						<Select
							value={cfg.matchesPerTie ?? 'single'}
							onChange={(e) => {
								const v = e.target.value;
								const patch: Record<string, unknown> = { ...cfg, matchesPerTie: v };
								if (v === 'double' && cfg.finalMatchesPerTie == null) {
									patch.finalMatchesPerTie = 'single';
								}
								onChange(stage.id, { config: patch });
							}}
						>
							<option value="single">Único</option>
							<option value="double">Ida y vuelta</option>
						</Select>
					</FieldRow>
					{(cfg.matchesPerTie ?? 'single') === 'double' ? (
						<FieldRow label="Final" hint="Las rondas previas siguen ida y vuelta; la final puede ser partido único (ej. Champions).">
							<Select
								value={cfg.finalMatchesPerTie ?? 'single'}
								onChange={(e) => onChange(stage.id, { config: { ...cfg, finalMatchesPerTie: e.target.value } })}
							>
								<option value="single">Partido único</option>
								<option value="double">Ida y vuelta</option>
							</Select>
						</FieldRow>
					) : null}
					{numAdvancing === 1 && (
						<FieldRow label="Tercer puesto">
							<Select value={cfg.thirdPlace ?? 'no'} onChange={(e) => onChange(stage.id, { config: { ...cfg, thirdPlace: e.target.value } })}>
								<option value="no">No</option>
								<option value="yes">Sí</option>
							</Select>
						</FieldRow>
					)}
					<div className="pt-3 border-t border-white/10">
						<KnockoutOutgoingRelation
							numAdvancing={numAdvancing}
							advancingToStageId={advancingToStageId}
							advancingOptions={advancingOptions}
							allStages={allStages}
							stageId={stage.id}
							onChangeNumAdvancing={handleNumAdvancingChange}
							onChangeDestination={handleDestinationChange}
						/>
					</div>
				</div>
			);
		}
		case 'composed': {
			return (
				<div className="text-xs opacity-80">Configura sub-etapas y relaciones en las pestañas correspondientes.</div>
			);
		}
		default:
			return null;
	}
}

function computeInbound(stageId: string, allStages: StageDraft[]): Array<{ from: string; count: number; label: string; }> {
	const inbound: Array<{ from: string; count: number; label: string; }> = [];
	for (const s of allStages) {
		for (const r of s.relations || []) {
			const targetsThis =
				r.toStageId === stageId ||
				(r.toExternal?.tournamentId === 'this' && r.toExternal?.stageId === stageId);
			if (targetsThis) {
				const count = countFromSelection(r.selection, s);
				inbound.push({ from: s.name, count, label: r.label });
			}
		}
	}
	return inbound;
}

function countFromSelection(sel: Selection, fromStage: StageDraft): number {
	// bestN selects the best N teams from a given position across ALL groups (not per-group)
	if (sel.kind === 'bestN') return sel.count;
	if (fromStage.kind === 'groups') {
		const cfg = (fromStage.config || {}) as any;
		const numGroups = Number(cfg.numGroups) || 0;
		const teamsPerGroup = Number(cfg.teamsPerGroup) || 0;
		if (numGroups <= 0) return 0;
		const perGroup = sel.kind === 'top' ? sel.count : sel.kind === 'bottom' ? Math.min(sel.count, teamsPerGroup || sel.count) : Math.max(0, sel.to - sel.from + 1);
		return perGroup * numGroups;
	}
	// league / knockout: posiciones globales
	if (sel.kind === 'top') return sel.count;
	if (sel.kind === 'bottom') return sel.count;
	return Math.max(0, sel.to - sel.from + 1);
}

function buildAdvancingOptions(numParticipants: number): Array<{ value: number; label: string }> {
	if (!numParticipants || numParticipants < 2) return [];
	const opts: Array<{ value: number; label: string }> = [];
	let adv = numParticipants;
	let rounds = 0;
	while (adv >= 2) {
		adv = Math.floor(adv / 2);
		rounds++;
		const rStr = rounds === 1 ? '1 ronda' : `${rounds} rondas`;
		const label = adv === 1
			? `1 campeón — bracket completo (${rStr})`
			: `${adv} clasificados — ${rStr}`;
		opts.push({ value: adv, label });
	}
	return opts;
}

function KnockoutOutgoingRelation({
	numAdvancing,
	advancingToStageId,
	advancingOptions,
	allStages,
	stageId,
	onChangeNumAdvancing,
	onChangeDestination,
}: {
	numAdvancing: number;
	advancingToStageId: string;
	advancingOptions: { value: number; label: string }[];
	allStages: StageDraft[];
	stageId: string;
	onChangeNumAdvancing: (n: number) => void;
	onChangeDestination: (id: string) => void;
}) {
	const isComplete = numAdvancing === 1 || (numAdvancing > 1 && !!advancingToStageId);
	const [editing, setEditing] = React.useState(!isComplete);

	// Si el estado externo cambia a incompleto, volver a modo edición
	React.useEffect(() => {
		if (!isComplete) setEditing(true);
	}, [isComplete]);

	const destName = allStages.find((s) => s.id === advancingToStageId)?.name ?? '';
	const advLabel = advancingOptions.find((o) => o.value === numAdvancing)?.label ?? '';

	return (
		<div className="space-y-2">
			<div className="text-xs font-semibold uppercase tracking-wider text-white/40">Relaciones salientes</div>

			{!editing ? (
				<ul className="space-y-1.5">
					<li className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
						<span className="shrink-0 w-2 h-2 rounded-full bg-emerald-400" />
						<div className="flex-1 min-w-0 text-xs">
							{numAdvancing === 1 ? (
								<span className="font-semibold text-white/85">{advLabel}</span>
							) : (
								<>
									<span className="font-semibold text-white/85">{advLabel}</span>
									<span className="text-white/35 mx-1.5">→</span>
									<span className="text-white/65">{destName}</span>
								</>
							)}
						</div>
						<button
							type="button"
							onClick={() => setEditing(true)}
							className="shrink-0 p-1 rounded text-white/30 hover:text-white/80 hover:bg-white/8 transition-colors"
							aria-label="Editar"
						>
							<svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
								<path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81 3.23 11.33c-.03.03-.05.064-.06.1l-.635 2.222 2.222-.635a.25.25 0 00.1-.06l6.532-6.507z"/>
							</svg>
						</button>
						{numAdvancing > 1 && advancingToStageId && (
							<button
								type="button"
								onClick={() => { onChangeDestination(''); }}
								className="shrink-0 p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
								aria-label="Eliminar destino"
							>
								<svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
									<path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 000 1.5h.3l.815 8.15A1.5 1.5 0 005.357 15h5.285a1.5 1.5 0 001.493-1.35l.815-8.15h.3a.75.75 0 000-1.5H11v-.75A2.25 2.25 0 008.75 1h-1.5A2.25 2.25 0 005 3.25zm2.25-.75a.75.75 0 00-.75.75V4h3v-.75a.75.75 0 00-.75-.75h-1.5zM6.05 6a.75.75 0 01.787.713l.275 5.5a.75.75 0 01-1.498.075l-.275-5.5A.75.75 0 016.05 6zm3.9 0a.75.75 0 01.712.787l-.275 5.5a.75.75 0 01-1.498-.075l.275-5.5a.75.75 0 01.786-.712z" clipRule="evenodd"/>
								</svg>
							</button>
						)}
					</li>
				</ul>
			) : (
				<div className="rounded-xl border border-white/12 bg-white/4 p-3 space-y-3">
					<div className="flex flex-wrap items-center gap-2">
						{advancingOptions.length > 0 && (
							<select value={numAdvancing} onChange={(e) => onChangeNumAdvancing(Number(e.target.value))}
								className="rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-white/25">
								{advancingOptions.map((o) => (
									<option key={o.value} value={o.value}>{o.label}</option>
								))}
							</select>
						)}
						{numAdvancing > 1 && (
							<>
								<span className="text-xs text-white/40 shrink-0">→</span>
								<select value={advancingToStageId} onChange={(e) => onChangeDestination(e.target.value)}
									className="flex-1 rounded-lg bg-white/8 border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-white/25">
									<option value="">— Sin etapa destino</option>
									{allStages.filter((s) => s.id !== stageId).map((s) => (
										<option key={s.id} value={s.id}>{s.name}</option>
									))}
								</select>
							</>
						)}
					</div>
					<div className="flex justify-end">
						<button type="button" onClick={() => setEditing(false)}
							className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:text-white/80 transition-colors">
							{isComplete ? 'Listo' : 'Cancelar'}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

function syncAdvancingRelation(
	relations: StageDraft['relations'],
	numAdvancing: number,
	toStageId: string | undefined
): StageDraft['relations'] {
	const filtered = (relations ?? []).filter((r) => r.id !== '__advancing__');
	if (toStageId && numAdvancing >= 1) {
		filtered.push({
			id: '__advancing__',
			label: 'Clasificados',
			toStageId,
			selection: { kind: 'top', count: numAdvancing },
		});
	}
	return filtered;
}