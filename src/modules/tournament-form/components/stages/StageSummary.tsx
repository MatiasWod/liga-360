import React from 'react';
import type { StageDraft, Selection } from './StageBuilder';

export const StageSummary: React.FC<{
	stage: StageDraft;
	allStages: StageDraft[];
	lookupStages?: StageDraft[];
	onRemoveRelation?: (relationId: string) => void;
}> = ({ stage, allStages, lookupStages, onRemoveRelation }) => {
	const pool = lookupStages ?? allStages;
	if (stage.kind === 'league') return <LeagueSummary stage={stage} allStages={allStages} legendStages={pool} onRemoveRelation={onRemoveRelation} />;
	if (stage.kind === 'groups') return <GroupsSummary stage={stage} allStages={allStages} legendStages={pool} onRemoveRelation={onRemoveRelation} />;
	if (stage.kind === 'knockout') return <KnockoutSummary stage={stage} />;
	return null;
};

const COLORS = ['bg-brand-green', 'bg-brand-blueLight', 'bg-amber-500', 'bg-fuchsia-500', 'bg-cyan-500'];

function LeagueSummary({
	stage,
	allStages,
	legendStages,
	onRemoveRelation,
}: {
	stage: StageDraft;
	allStages: StageDraft[];
	legendStages: StageDraft[];
	onRemoveRelation?: (relationId: string) => void;
}) {
	const cfg = (stage.config || {}) as any;
	const n = Number(cfg.numParticipants) > 0 ? Number(cfg.numParticipants) : 10;
	const rows = Array.from({ length: n }, (_, i) => i + 1);
	const relations = stage.relations ?? [];
	function colorsForPosition(pos: number): string[] {
		const matches: string[] = [];
		for (let i = 0; i < relations.length; i++) {
			const r = relations[i];
			if (appliesToPosition(r.selection, pos, n)) matches.push(COLORS[i % COLORS.length]);
		}
		return matches;
	}
	return (
		<div className="rounded-lg border border-white/10 p-3">
			<div className="flex gap-4">
				<div className="flex-1 overflow-hidden">
					<table className="w-full text-xs">
						<thead className="text-left opacity-80">
							<tr>
								<th className="py-1 pr-2">Pos</th>
								<th className="py-1">Competidor</th>
								<th className="py-1 w-16"></th>
							</tr>
						</thead>
						<tbody>
							{rows.map((pos) => {
								const colors = colorsForPosition(pos);
								return (
									<tr key={pos}>
										<td className="py-0.5 pr-2 w-10">{pos}</td>
										<td className="py-0.5 truncate">Competidor {pos}</td>
										<td className="py-0.5">
											<div className="flex items-center gap-1">
												{colors.map((c, i) => (
														<span key={i} className={`inline-block w-2.5 h-2.5 rounded-full ${c}`}></span>
												))}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				<Legend relations={relations} allStages={legendStages} onRemoveRelation={onRemoveRelation} />
			</div>
		</div>
	);
}

function GroupsSummary({
	stage,
	allStages,
	legendStages,
	onRemoveRelation,
}: {
	stage: StageDraft;
	allStages: StageDraft[];
	legendStages: StageDraft[];
	onRemoveRelation?: (relationId: string) => void;
}) {
	const cfg = (stage.config || {}) as any;
	const g = Number(cfg.numGroups) > 0 ? Number(cfg.numGroups) : 4;
	const per = Number(cfg.teamsPerGroup) > 0 ? Number(cfg.teamsPerGroup) : 4;
	const relations = stage.relations ?? [];
	return (
		<div className="rounded-lg border border-white/10 p-3">
			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
				{Array.from({ length: g }, (_, gi) => (
					<div key={gi} className="rounded-md border border-white/10">
						<div className="text-xs font-medium opacity-90 px-2 py-1 border-b border-white/10">Grupo {String.fromCharCode(65 + gi)}</div>
						<ul className="text-xs">
							{Array.from({ length: per }, (_, i) => i + 1).map((pos) => {
								const dotColors: string[] = [];
								for (let rIndex = 0; rIndex < relations.length; rIndex++) {
									const r = relations[rIndex];
									if (appliesToPosition(r.selection, pos, per)) { dotColors.push(COLORS[rIndex % COLORS.length]); }
								}
								return (
									<li key={pos} className={`px-2 py-0.5 flex items-center justify-between`}>
										<span>Pos {pos}</span>
										<span className="inline-flex items-center gap-1">
											{dotColors.map((c, i) => (
												<span key={i} className={`inline-block w-2.5 h-2.5 rounded-full ${c}`}></span>
											))}
										</span>
									</li>
								);
							})}
						</ul>
					</div>
				))}
			</div>
			<div className="mt-3">
				<Legend relations={relations} allStages={legendStages} onRemoveRelation={onRemoveRelation} />
			</div>
		</div>
	);
}

function KnockoutSummary({ stage }: { stage: StageDraft; }) {
	const cfg = (stage.config || {}) as any;
	const nRaw = Number(cfg.numParticipants) > 0 ? Number(cfg.numParticipants) : 8;
	// Ajuste a potencia de 2 para visualización simétrica
	const n = Math.pow(2, Math.round(Math.log2(Math.max(2, nRaw))));
	const rounds = Math.ceil(Math.log2(n)); // columnas de izquierda a derecha, la última es la Final
	const capacity = Math.pow(2, rounds);
	const byes = Math.max(0, capacity - nRaw);
	// cantidad de partidos por ronda respetando nRaw (con byes en primera ronda)
	const matchesPerRound: number[] = Array.from({ length: rounds }, (_, r) => {
		if (r === 0) return Math.max(0, Math.floor((nRaw - byes) / 2));
		return capacity / Math.pow(2, r + 1);
	});

	function labelForRound(r: number) {
		// r: 0 = primera ronda, rounds-1 = final
		const remaining = rounds - 1 - r;
		if (rounds === 1) return 'Final';
		if (remaining === 0) return 'Final';
		if (remaining === 1) return 'Semifinal';
		if (remaining === 2) return 'Cuartos';
		if (remaining === 3) return 'Octavos';
		if (remaining === 4) return 'Dieciseisavos';
		return `Ronda ${r + 1}`;
	}
	function codeForRound(r: number) {
		const remaining = rounds - 1 - r;
		if (remaining === 0) return 'F';
		if (remaining === 1) return 'S';
		if (remaining === 2) return 'C';
		if (remaining >= 3) return 'O';
		return `R${r + 1}`;
	}

	// Disposición en una sola grilla de izquierda a derecha.
	// Usamos grid-auto-rows para generar una malla y posicionar cada match
	// con spans y offsets que producen centrado vertical progresivo.
	const autoRowPx = 22; // unidad de alto (ajusta el espaciado vertical/aire)

	function rowSpanForRound(r: number) {
		// Cada ronda ocupa el doble de altura que la anterior
		return Math.pow(2, r + 1);
	}
	function rowOffsetForRound(r: number) {
		// Offset para centrar respecto a la ronda anterior
		return Math.pow(2, r);
	}

	return (
		<div className="rounded-lg border border-white/10 p-3">
			<div
				className="grid gap-x-10 gap-y-6 items-start"
				style={{
					gridTemplateColumns: `repeat(${rounds}, minmax(0, 1fr))`,
					gridAutoRows: `minmax(${autoRowPx}px, auto)`,
				}}
			>
				{Array.from({ length: rounds }, (_, r) => {
					const totalSlots = capacity / Math.pow(2, r + 1); // posiciones teóricas
					const count = Math.max(0, Math.min(matchesPerRound[r], totalSlots));
					const span = rowSpanForRound(r);
					const offset = rowOffsetForRound(r);
					const roundCode = codeForRound(r);
					return (
						<div key={`col-${r}`} className="contents">
							<div className="col-start-auto col-end-auto">
								<div className={`inline-block text-xs font-medium opacity-90 mb-2 px-2 py-1 rounded-md border border-white/10 bg-white/10 ${r === rounds - 1 ? 'mx-auto' : ''}`}>
									{labelForRound(r)}
								</div>
							</div>
							{Array.from({ length: count }, (_, m) => {
								// distribuir los partidos en los slots teóricos para mantener centrado
								const slotIndex = Math.floor(m * (totalSlots / count));
								const rowStart = slotIndex * span + offset + 1;
								return (
									<div
										key={`r${r}-m${m}`}
										className="relative rounded-xl border border-white/15 bg-white/10 backdrop-blur-sm p-3 text-xs shadow-sm"
										style={{ gridColumn: r + 1, gridRow: `${rowStart} / span ${span - offset}` }}
									>
										<div className="absolute -top-3 left-3 text-[10px] px-2 py-0.5 rounded-full border border-brand-greenDark/40 bg-brand-green/30 text-white/90">
											{roundCode}{m + 1}
										</div>
										<div className="space-y-2">
											<div className="truncate">Competidor A</div>
											<div className="h-px bg-white/10"></div>
											<div className="truncate">Competidor B</div>
										</div>
									</div>
								);
							})}
						</div>
					);
				})}

				{/* Tercer puesto bajo la final si corresponde */}
				{cfg.thirdPlace === 'yes' && (() => {
					const rFinal = Math.max(0, rounds - 1);
					const finalSpan = rowSpanForRound(rFinal);
					const finalOffset = rowOffsetForRound(rFinal);
					const finalRowStart = finalOffset + 1;
					const finalHeight = finalSpan - finalOffset;
					const thirdStart = finalRowStart + finalHeight + 2;
					return (
						<div
							className="relative rounded-xl border border-white/15 bg-white/10 backdrop-blur-sm p-3 text-xs shadow-sm"
							style={{ gridColumn: rounds, gridRow: `${thirdStart} / span ${finalHeight}` }}
						>
							<div className="absolute -top-3 left-3 text-[10px] px-2 py-0.5 rounded-full border border-brand-greenDark/40 bg-brand-green/30 text-white/90">
								3P
							</div>
							<div className="space-y-2">
								<div className="truncate">Perdedor S1</div>
								<div className="h-px bg-white/10"></div>
								<div className="truncate">Perdedor S2</div>
							</div>
						</div>
					);
				})()}
			</div>
		</div>
	);
}

function appliesToPosition(sel: Selection, pos: number, total: number) {
	if (sel.kind === 'top') return pos <= sel.count;
	if (sel.kind === 'bottom') return pos > total - sel.count;
	if (sel.kind === 'bestN') return pos === sel.fromPosition;
	if (sel.kind === 'range') return pos >= sel.from && pos <= sel.to;
	return false;
}

const Legend: React.FC<{
	relations: NonNullable<StageDraft['relations']>;
	allStages: StageDraft[];
	onRemoveRelation?: (relationId: string) => void;
}> = ({ relations, allStages, onRemoveRelation }) => {
	if (!relations || relations.length === 0) return null;
	return (
		<div className="text-xs">
			<div className="font-medium mb-1 opacity-80">Leyenda</div>
			<ul className="space-y-1">
				{relations.map((r, i) => {
					const to = r.toStageId ? allStages.find((s) => s.id === r.toStageId) : undefined;
					let dest = '—';
					if (r.toExternal) {
						if (r.toExternal.tournamentId === 'this' && r.toExternal.stageId) {
							dest = allStages.find((s) => s.id === r.toExternal?.stageId)?.name ?? r.toExternal.stageName ?? r.toExternal.stageId;
						} else {
							dest = r.toExternal.stageName || r.toExternal.stageId;
						}
					} else if (to) {
						dest = to.name;
					}
					return (
						<li key={r.id} className="flex items-center gap-2">
							<span className={`inline-block w-3 h-3 rounded ${COLORS[i % COLORS.length]}`}></span>
							<span>{r.label}</span>
							<span className="opacity-70">→ {dest}</span>
							{r.carryOver && <span className="opacity-70"> · CO:{r.carryOver.mode}</span>}
							{onRemoveRelation && (
								<button
									type="button"
									onClick={() => onRemoveRelation(r.id)}
									className="ml-auto text-[10px] opacity-60 hover:opacity-100 hover:text-red-400 transition-colors"
									aria-label={`Eliminar relación ${r.label}`}
								>
									✕
								</button>
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
}; 