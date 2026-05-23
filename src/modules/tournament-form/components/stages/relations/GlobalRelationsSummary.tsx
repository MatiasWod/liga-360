import React from 'react';
import type { StageDraft, Selection } from '../StageBuilder';

interface Props {
	stages: StageDraft[];
	/** Pool para resolver nombres de etapa destino (p. ej. otra competencia). Por defecto `stages`. */
	lookupStages?: StageDraft[];
	/** Quitar la relación del estado local (origen = etapa emisora). */
	onRemoveRelation?: (fromStageId: string, relationId: string) => void;
}

export const GlobalRelationsSummary: React.FC<Props> = ({ stages, lookupStages, onRemoveRelation }) => {
	const items = React.useMemo(
		() => collectRelations(stages, lookupStages ?? stages),
		[stages, lookupStages]
	);
	if (items.length === 0) return null;
	return (
		<div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-semibold tracking-wide">Resumen de relaciones entre etapas</h3>
				<span className="text-xs opacity-70">{items.length} relación(es)</span>
			</div>
			<div className="overflow-auto">
				<table className="w-full text-xs">
					<thead className="text-left opacity-80">
						<tr>
							<th className="py-2 pr-3">Origen</th>
							<th className="py-2 pr-3">Nombre</th>
							<th className="py-2 pr-3">Selección</th>
							<th className="py-2 pr-3">CarryOver</th>
							<th className="py-2 pr-3">Destino</th>
							{onRemoveRelation ? <th className="py-2 w-24 text-right">Acción</th> : null}
						</tr>
					</thead>
					<tbody>
						{items.map((it) => (
							<tr key={it.id} className="border-t border-white/5">
								<td className="py-1 pr-3 whitespace-nowrap">{it.fromName}</td>
								<td className="py-1 pr-3">{it.label}</td>
								<td className="py-1 pr-3 whitespace-nowrap">{renderSelection(it.selection)}</td>
								<td className="py-1 pr-3 whitespace-nowrap">{it.carryOverMode ?? '—'}</td>
								<td className="py-1 pr-3">{it.toName}</td>
								{onRemoveRelation ? (
									<td className="py-1 text-right align-middle">
										<button
											type="button"
											className="rounded px-2 py-1 text-[11px] text-white/90 hover:bg-red-500/25 hover:text-white"
											onClick={() => onRemoveRelation(it.fromId, it.id)}
											aria-label={`Eliminar relación ${it.label}`}
										>
											Eliminar
										</button>
									</td>
								) : null}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};

function collectRelations(stages: StageDraft[], lookupPool: StageDraft[]) {
	const items: Array<{ id: string; fromId: string; fromName: string; toId?: string; toName: string; label: string; selection: Selection; carryOverMode?: string; }> = [];
	for (const s of stages) {
		for (const r of s.relations || []) {
			let toName = '—';
			if (r.toStageId) {
				const to = lookupPool.find((x) => x.id === r.toStageId);
				toName = to?.name ?? '—';
			} else if (r.toExternal) {
				const ext = r.toExternal;
				if (ext.tournamentId === 'this' && ext.stageId) {
					const to = lookupPool.find((x) => x.id === ext.stageId);
					toName = to?.name ?? ext.stageName ?? ext.stageId;
				} else {
					toName =
						ext.stageName ??
						(ext.tournamentId && ext.stageId ? `${ext.tournamentId} • ${ext.stageId}` : '—');
				}
			}
			items.push({ id: r.id, fromId: s.id, fromName: s.name, toId: r.toStageId, toName, label: r.label, selection: r.selection, carryOverMode: r.carryOver?.mode });
		}
	}
	return items;
}

function renderSelection(sel: Selection) {
	if (sel.kind === 'top') return `Primeros ${sel.count}`;
	if (sel.kind === 'bottom') return `Últimos ${sel.count}`;
	if (sel.kind === 'bestN') return `Mejores ${sel.count} del puesto ${sel.fromPosition} entre grupos`;
	return `Puestos ${sel.from} a ${sel.to}`;
} 