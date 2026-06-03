import React from 'react';
import type { StageDraft } from '../StageBuilder';

interface Props {
	stages: StageDraft[];
}

const COLORS = ['#16a34a', '#576CBC', '#f59e0b', '#a21caf', '#06b6d4'];

export const RelationsDiagram: React.FC<Props> = ({ stages }) => {
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const nodeRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
	const [edges, setEdges] = React.useState<Array<{ x1: number; y1: number; x2: number; y2: number; color: string; label: string }>>([]);
	const layers = React.useMemo(() => computeLayers(stages), [stages]);

	React.useLayoutEffect(() => {
		function computeEdges() {
			const cont = containerRef.current;
			if (!cont) return;
			const contRect = cont.getBoundingClientRect();
			const list: Array<{ x1: number; y1: number; x2: number; y2: number; color: string; label: string }> = [];
			stages.forEach((s, sIndex) => {
				(s.relations || []).forEach((r, rIndex) => {
					if (!r.toStageId) return; // sólo dibujamos internas; las externas se listan en resumen
					const fromEl = nodeRefs.current[s.id];
					const toEl = nodeRefs.current[r.toStageId];
					if (!fromEl || !toEl) return;
					const fromRect = fromEl.getBoundingClientRect();
					const toRect = toEl.getBoundingClientRect();
					const x1 = fromRect.right - contRect.left;
					const y1 = fromRect.top - contRect.top + fromRect.height / 2;
					const x2 = toRect.left - contRect.left;
					const y2 = toRect.top - contRect.top + toRect.height / 2;
					list.push({ x1, y1, x2, y2, color: COLORS[(sIndex + rIndex) % COLORS.length], label: r.label });
				});
			});
			setEdges(list);
		}
		computeEdges();
		const onResize = () => computeEdges();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, [stages, layers.length]);

	return (
		<div className="rounded-xl border border-white/10 bg-white/5 p-4">
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-semibold tracking-wide">Esquema</h3>
				<span className="text-xs opacity-70">{stages.length} etapa(s)</span>
			</div>
			<div ref={containerRef} className="relative">
				{/* SVG overlay */}
				<svg className="absolute inset-0 w-full h-full pointer-events-none">
					{edges.map((e, i) => {
						const dx = Math.max(40, Math.abs(e.x2 - e.x1) * 0.4);
						const c1x = e.x1 + dx;
						const c2x = e.x2 - dx;
						const path = `M ${e.x1} ${e.y1} C ${c1x} ${e.y1}, ${c2x} ${e.y2}, ${e.x2} ${e.y2}`;
						const mx = (e.x1 + e.x2) / 2;
						const my = (e.y1 + e.y2) / 2;
						return (
							<g key={i}>
								<defs>
									<marker id={`arrow-${i}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
										<path d="M0,0 L8,4 L0,8 z" fill={e.color} />
									</marker>
								</defs>
								<path d={path} stroke={e.color} strokeWidth="2" fill="none" markerEnd={`url(#arrow-${i})`} />
								<text x={mx} y={my - 4} fontSize="10" fill="#fff" textAnchor="middle" className="opacity-80">{e.label}</text>
							</g>
						);
					})}
				</svg>
				{/* Columns */}
				<div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${layers.length || 1}, minmax(220px, 1fr))` }}>
					{layers.map((layer, li) => (
						<div key={li} className="space-y-3">
							{layer.map((stage) => (
								<div
									key={stage.id}
									ref={(el) => { nodeRefs.current[stage.id] = el; }}
									className="relative rounded-lg border border-white/10 bg-brand-blue/40 p-3"
								>
									<div className="text-xs opacity-80">{labelKind(stage.kind)}</div>
									<div className="text-sm font-medium">{stage.name}</div>
									<div className="mt-2 h-10">
										{stage.kind === 'groups' && <GroupsGlyph />}
										{stage.kind === 'league' && <LeagueGlyph />}
										{stage.kind === 'knockout' && <KnockoutGlyph />}
									</div>
								</div>
							))}
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

function labelKind(kind: StageDraft['kind']) {
	return kind === 'groups' ? 'Grupos' : kind === 'league' ? 'Liga' : 'Eliminación';
}

function computeLayers(stages: StageDraft[]) {
	const byId: Record<string, StageDraft> = Object.fromEntries(stages.map((s) => [s.id, s]));
	const inboundCount: Record<string, number> = {};
	stages.forEach((s) => { inboundCount[s.id] = 0; });
	stages.forEach((s) => (s.relations || []).forEach((r) => { if (r.toStageId && byId[r.toStageId]) inboundCount[r.toStageId]++; }));
	const layers: StageDraft[][] = [];
	const placed = new Set<string>();
	let frontier = stages.filter((s) => inboundCount[s.id] === 0);
	if (frontier.length === 0) frontier = [...stages];
	while (frontier.length > 0) {
		layers.push(frontier);
		frontier.forEach((s) => placed.add(s.id));
		const next: StageDraft[] = [];
		stages.forEach((s) => {
			if (placed.has(s.id)) return;
			const allFromPlaced = (stages.find((x) => (x.relations || []).some((r) => r.toStageId === s.id && !placed.has(x.id))) == null);
			if (allFromPlaced) next.push(s);
		});
		if (next.length === 0) {
			// put remaining in one layer to break cycles
			stages.forEach((s) => { if (!placed.has(s.id)) next.push(s); });
		}
		frontier = next.filter((x, i, arr) => arr.indexOf(x) === i);
		// avoid infinite loop
		if (frontier.length === 0) break;
	}
	return layers;
}

function GroupsGlyph() {
	const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
	return (
		<div className="grid grid-cols-3 gap-1">
			{labels.map((l) => (
				<div key={l} className="h-4 rounded border border-white/20 text-[10px] flex items-center justify-center opacity-80">{l}</div>
			))}
		</div>
	);
}

function LeagueGlyph() {
	return (
		<div className="space-y-1">
			<div className="h-2 bg-white/20 rounded" />
			<div className="h-2 bg-white/15 rounded" />
			<div className="h-2 bg-white/10 rounded" />
			<div className="h-2 bg-white/10 rounded w-2/3" />
		</div>
	);
}

function KnockoutGlyph() {
	return (
		<svg width="100%" height="100%" viewBox="0 0 120 40">
			<g stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2" fill="none">
				<path d="M10 10 H40 V20 H60" />
				<path d="M10 30 H40 V20 H60" />
				<path d="M60 20 H80 V15 H110" />
				<path d="M60 20 H80 V25 H110" />
			</g>
		</svg>
	);
} 