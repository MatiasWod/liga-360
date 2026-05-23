import React from 'react';
import { StageCard } from './StageCard';
import { StagePalette } from './StagePalette';
import { GlobalRelationsSummary } from './relations/GlobalRelationsSummary';

export type StageKind = 'groups' | 'league' | 'knockout' | 'composed';

export interface StageDraft {
	id: string;
	name: string;
	kind: StageKind;
	config: Record<string, unknown>;
	relations?: Relation[];
	children?: StageDraft[]; // para etapas compuestas
}

export type Selection =
	| { kind: 'top'; count: number }
	| { kind: 'range'; from: number; to: number }
	| { kind: 'bottom'; count: number }
	| { kind: 'bestN'; count: number; fromPosition: number };

export type CarryOverMode = 'none' | 'all' | 'percent' | 'headToHead' | 'seriesAdvantage';

export interface CarryOverConfig {
	mode: CarryOverMode;
	fields?: string[];
	percent?: number; // para mode: 'percent'
	bestOf?: number; // para mode: 'seriesAdvantage'
	advantageWins?: number; // para mode: 'seriesAdvantage'
}

export interface ExternalStageRef {
	tournamentId: string;
	tournamentName?: string;
	stageId: string;
	stageName?: string;
}

export interface Relation {
	id: string;
	label: string; // definido por el usuario (ej: avance, ascenso, descenso)
	toStageId?: string; // destino interno en este builder
	toExternal?: ExternalStageRef; // destino externo (otro torneo o competencia)
	selection: Selection;
	carryOver?: CarryOverConfig; // reglas de arrastre entre etapas
}

export interface CrossCompetitionOption {
	competitionId: string;
	competitionName: string;
	stages: StageDraft[];
}

interface StageBuilderProps {
	value?: StageDraft[];
	onChangeStages?: (next: StageDraft[]) => void;
	crossOptions?: CrossCompetitionOption[]; // otras solapas
    maxStages?: number;
	/** Etapas de todas las competencias del torneo (resumen y etiquetas de destino cruzado). */
	allStagesGlobal?: StageDraft[];
	/** Quitar relación del estado cuando el origen puede estar en otra competencia. */
	onRemoveRelationGlobal?: (fromStageId: string, relationId: string) => void;
}

export const StageBuilder: React.FC<StageBuilderProps> = ({
	value,
	onChangeStages,
	crossOptions,
	maxStages,
	allStagesGlobal,
	onRemoveRelationGlobal,
}) => {
	const [local, setLocal] = React.useState<StageDraft[]>([]);
	const stages = value ?? local;

	function setStages(updater: (prev: StageDraft[]) => StageDraft[]) {
		if (onChangeStages) onChangeStages(updater(stages));
		else setLocal((prev) => updater(prev));
	}

    function handleAdd(kind: StageKind) {
        if (typeof maxStages === 'number' && stages.length >= maxStages) {
            window.alert(`No se pueden definir más de ${maxStages} etapas en esta competición (MVP)`);
            return;
        }
		const suggested = defaultNameFor(kind);
		const name = window.prompt('Nombre de la etapa', suggested);
		if (!name) return;
		const newStage: StageDraft = {
			id: crypto.randomUUID(),
			name: name.trim(),
			kind,
			config: {},
			relations: []
		};
		setStages((prev) => [...prev, newStage]);
	}

	function updateStage(id: string, partial: Partial<StageDraft>) {
		setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...partial } : s)));
	}

	function removeStage(id: string) {
		setStages((prev) => prev.filter((s) => s.id !== id));
	}

	function removeRelation(fromStageId: string, relationId: string) {
		if (onRemoveRelationGlobal) {
			onRemoveRelationGlobal(fromStageId, relationId);
			return;
		}
		setStages((prev) =>
			prev.map((s) =>
				s.id === fromStageId
					? { ...s, relations: (s.relations || []).filter((r) => r.id !== relationId) }
					: s
			)
		);
	}

	const lookupPool = allStagesGlobal && allStagesGlobal.length > 0 ? allStagesGlobal : stages;
	const relationScanStages = allStagesGlobal && allStagesGlobal.length > 0 ? allStagesGlobal : stages;

	return (
		<div id="stage-builder-root" className="relative">
			{stages.length === 0 && (
				<div className="rounded-lg border border-dashed border-white/20 p-6 text-sm opacity-80">
					No hay etapas. Agrega una desde la paleta.
				</div>
			)}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{stages.map((stage) => (
					<StageCard
						key={stage.id}
						stage={stage}
						allStages={stages}
						lookupStages={lookupPool}
						crossOptions={crossOptions}
						onChange={updateStage}
						onRemove={removeStage}
					/>
				))}
			</div>
			{stages.length > 0 && (
				<GlobalRelationsSummary stages={relationScanStages} lookupStages={lookupPool} onRemoveRelation={removeRelation} />
			)}
			<StagePalette onAdd={handleAdd} />
		</div>
	);
};

function defaultNameFor(kind: StageKind): string {
	switch (kind) {
		case 'groups':
			return 'Fase de grupos';
		case 'league':
			return 'Liga';
		case 'knockout':
			return 'Eliminación directa';
		case 'composed':
			return 'Compuesta';
		default:
			return 'Etapa';
	}
}

function computeInbound(stageId: string, allStages: StageDraft[]): Array<{ from: string; count: number; label: string; }> {
	const inbound: Array<{ from: string; count: number; label: string; }> = [];
	for (const s of allStages) {
		for (const r of s.relations || []) {
			if (r.toStageId === stageId) {
				const count = countFromSelection(r.selection, s);
				inbound.push({ from: s.name, count, label: r.label });
			}
		}
	}
	return inbound;
}

function countFromSelection(sel: Selection, fromStage: StageDraft): number {
	if (sel.kind === 'bestN') return sel.count;
	if (fromStage.kind === 'groups') {
		const cfg = (fromStage.config || {}) as any;
		const numGroups = Number(cfg.numGroups) || 0;
		const teamsPerGroup = Number(cfg.teamsPerGroup) || 0;
		if (numGroups <= 0) return 0;
		const perGroup = sel.kind === 'top' ? sel.count : sel.kind === 'bottom' ? Math.min(sel.count, teamsPerGroup || sel.count) : sel.kind === 'range' ? Math.max(0, sel.to - sel.from + 1) : 0;
		return perGroup * numGroups;
	}
	// league / knockout: posiciones globales
	if (sel.kind === 'top') return sel.count;
	if (sel.kind === 'bottom') return sel.count;
	if (sel.kind === 'range') return Math.max(0, sel.to - sel.from + 1);
	return 0;
} 