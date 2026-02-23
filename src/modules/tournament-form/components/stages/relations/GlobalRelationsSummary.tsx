import React from 'react';
import type { StageDraft, Selection } from '../StageBuilder';

interface Props {
	stages: StageDraft[];
}

export const GlobalRelationsSummary: React.FC<Props> = ({ stages }) => {
	const items = React.useMemo(() => collectRelations(stages), [stages]);
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
							<th className="py-2">Destino</th>
						</tr>
					</thead>
					<tbody>
						{items.map((it) => (
							<tr key={it.id} className="border-t border-white/5">
								<td className="py-1 pr-3 whitespace-nowrap">{it.fromName}</td>
								<td className="py-1 pr-3">{it.label}</td>
								<td className="py-1 pr-3 whitespace-nowrap">{renderSelection(it.selection)}</td>
								<td className="py-1 pr-3 whitespace-nowrap">{it.carryOverMode ?? '—'}</td>
								<td className="py-1">{it.toName}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};

function collectRelations(stages: StageDraft[]) {
	const items: Array<{ id: string; fromId: string; fromName: string; toId?: string; toName: string; label: string; selection: Selection; carryOverMode?: string; }> = [];
	for (const s of stages) {
		for (const r of s.relations || []) {
			let toName = '—';
			if (r.toStageId) {
				const to = stages.find((x) => x.id === r.toStageId);
				toName = to?.name ?? '—';
			} else if (r.toExternal) {
				toName = r.toExternal.stageName ?? `${r.toExternal.tournamentId} • ${r.toExternal.stageId}`;
			}
			items.push({ id: r.id, fromId: s.id, fromName: s.name, toId: r.toStageId, toName, label: r.label, selection: r.selection, carryOverMode: r.carryOver?.mode });
		}
	}
	return items;
}

function renderSelection(sel: Selection) {
	if (sel.kind === 'top') return `Primeros ${sel.count}`;
	if (sel.kind === 'bottom') return `Últimos ${sel.count}`;
	return `Puestos ${sel.from} a ${sel.to}`;
} 