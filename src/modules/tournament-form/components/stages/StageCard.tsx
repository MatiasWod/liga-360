import React from 'react';
import type { StageDraft, StageKind, Selection, CrossCompetitionOption } from './StageBuilder';
import { RelationsEditor } from './relations/RelationsEditor';
import { TieBreakEditor, RuleItem } from './tiebreak/TieBreakEditor';
import { StageSummary } from './StageSummary';

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
	const [tab, setTab] = React.useState<'details' | 'tiebreak' | 'relations'>('details');
	return (
		<div className="card p-4">
			<div className="flex items-start justify-between gap-3">
				<input
					value={stage.name}
					onChange={(e) => onChange(stage.id, { name: e.target.value })}
					className="text-base font-medium bg-transparent outline-none border-b border-transparent focus:border-white/30"
				/>
				<div className="flex items-center gap-2">
					<TypeBadge kind={stage.kind} />
					<button type="button" onClick={() => onRemove(stage.id)} className="text-xs opacity-80 hover:opacity-100">Eliminar</button>
				</div>
			</div>

			<div className="mt-4">
				<Tabs tab={tab} setTab={setTab} />
				<div className="mt-3">
					{tab === 'details' && (
						<StageConfig kind={stage.kind} stage={stage} allStages={allStages} inboundStages={inboundPool} onChange={onChange} />
					)}
					{tab === 'tiebreak' && (
						<TieBreakEditor value={stage.config?.tiebreak as RuleItem[] | undefined} onChange={(rules) => onChange(stage.id, { config: { ...stage.config, tiebreak: rules } })} />
					)}
					{tab === 'relations' && (
						<RelationsEditor stage={stage} allStages={allStages} lookupStages={lookupStages} crossOptions={crossOptions} onChange={onChange} />
					)}
				</div>
			</div>

			<div className="mt-6">
				<StageSummary stage={stage} allStages={allStages} lookupStages={lookupStages} />
			</div>
		</div>
	);
};

function Tabs({ tab, setTab }: { tab: 'details' | 'tiebreak' | 'relations'; setTab: (t: 'details' | 'tiebreak' | 'relations') => void; }) {
	return (
		<div className="inline-flex rounded-lg border border-brand-greenDark/40 bg-brand-greenDark/20 p-1 text-xs">
			<button type="button" onClick={() => setTab('details')} className={`px-3 py-1 rounded-md ${tab === 'details' ? 'bg-brand-green text-white' : 'hover:bg-brand-green/20'}`}>Detalles</button>
			<button type="button" onClick={() => setTab('tiebreak')} className={`px-3 py-1 rounded-md ${tab === 'tiebreak' ? 'bg-brand-green text-white' : 'hover:bg-brand-green/20'}`}>Desempate</button>
			<button type="button" onClick={() => setTab('relations')} className={`px-3 py-1 rounded-md ${tab === 'relations' ? 'bg-brand-green text-white' : 'hover:bg-brand-green/20'}`}>Relaciones</button>
		</div>
	);
}

function TypeBadge({ kind }: { kind: StageKind }) {
	const labelMap: Record<StageKind, string> = {
		groups: 'Grupos',
		league: 'Liga',
		knockout: 'Eliminación',
		composed: 'Compuesta'
	};
	return <span className="text-xs rounded-full bg-white/10 px-2 py-1">{labelMap[kind]}</span>;
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
	onChange,
}: {
	kind: StageKind;
	stage: StageDraft;
	allStages: StageDraft[];
	inboundStages: StageDraft[];
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
				</div>
			);
		}
		case 'league': {
			const suggested = inboundTotal || undefined;
			return (
				<div className="space-y-2">
					<FieldRow label="Participantes" hint={suggested ? `Sugerencia: ${suggested} provenientes de ${inbound.map(i => `${i.from} (${i.count})`).join(', ')}` : undefined}>
						<Input type="number" min={2} value={cfg.numParticipants ?? (suggested ?? '')} onChange={(e) => onChange(stage.id, { config: { ...cfg, numParticipants: parseInt(e.target.value || '0') } })} placeholder="Ej: 20" />
					</FieldRow>
					<FieldRow label="Rondas">
						<Select value={cfg.rounds ?? 'single'} onChange={(e) => onChange(stage.id, { config: { ...cfg, rounds: e.target.value } })}>
							<option value="single">Solo ida</option>
							<option value="double">Ida y vuelta</option>
						</Select>
					</FieldRow>
				</div>
			);
		}
		case 'knockout': {
			const suggested = inboundTotal || undefined;
			return (
				<div className="space-y-2">
					<FieldRow label="Participantes" hint={suggested ? `Sugerencia: ${suggested} provenientes de ${inbound.map(i => `${i.from} (${i.count})`).join(', ')}` : undefined}>
						<Input type="number" min={2} value={cfg.numParticipants ?? (suggested ?? '')} onChange={(e) => onChange(stage.id, { config: { ...cfg, numParticipants: parseInt(e.target.value || '0') } })} placeholder="Ej: 16" />
					</FieldRow>
					<FieldRow label="Partidos por llave">
						<Select value={cfg.matchesPerTie ?? 'single'} onChange={(e) => onChange(stage.id, { config: { ...cfg, matchesPerTie: e.target.value } })}>
							<option value="single">Único</option>
							<option value="double">Ida y vuelta</option>
						</Select>
					</FieldRow>
					<FieldRow label="Tercer puesto">
						<Select value={cfg.thirdPlace ?? 'no'} onChange={(e) => onChange(stage.id, { config: { ...cfg, thirdPlace: e.target.value } })}>
							<option value="no">No</option>
							<option value="yes">Sí</option>
						</Select>
					</FieldRow>
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