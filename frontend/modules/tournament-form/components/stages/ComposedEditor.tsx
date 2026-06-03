import React from 'react';
import type { StageDraft, StageKind } from './StageBuilder';
import { StagePalette } from './StagePalette';
import { AdvancementRulesEditor } from './advancement/AdvancementRulesEditor';

interface ComposedEditorProps {
	stage: StageDraft;
	onChange: (id: string, partial: Partial<StageDraft>) => void;
}

export const ComposedEditor: React.FC<ComposedEditorProps> = ({ stage, onChange }) => {
	const children = (stage.children ?? []) as StageDraft[];

	function addChild(kind: StageKind) {
		const child: StageDraft = {
			id: crypto.randomUUID(),
			name: defaultName(kind),
			kind,
			config: {}
		};
		onChange(stage.id, { children: [...children, child] });
	}

	function updateChild(id: string, partial: Partial<StageDraft>) {
		const updated = children.map((c) => (c.id === id ? { ...c, ...partial } : c));
		onChange(stage.id, { children: updated });
	}

	function removeChild(id: string) {
		const updated = children.filter((c) => c.id !== id);
		onChange(stage.id, { children: updated });
	}

	return (
		<div className="space-y-4">
			<div className="rounded-lg border border-white/10 p-3">
				<div className="flex items-center justify-between mb-3">
					<h4 className="font-medium">Sub-etapas</h4>
					<span className="text-xs opacity-70">Define las ligas/copas hijas</span>
				</div>
				{children.length === 0 && (
					<div className="text-sm opacity-80">Aún no hay sub-etapas.</div>
				)}
				<ul className="space-y-2">
					{children.map((child) => (
						<li key={child.id} className="rounded-md bg-white/5 border border-white/10 p-3">
							<div className="flex items-center justify-between gap-2">
								<input
									value={child.name}
									onChange={(e) => updateChild(child.id, { name: e.target.value })}
									className="bg-transparent outline-none border-b border-transparent focus:border-white/30"
								/>
								<span className="text-xs rounded-full bg-white/10 px-2 py-1">{label(child.kind)}</span>
								<button type="button" onClick={() => removeChild(child.id)} className="text-xs opacity-80 hover:opacity-100">Eliminar</button>
							</div>
						</li>
					))}
				</ul>
				<div className="mt-3">
					<StagePalette onAdd={addChild} />
				</div>
			</div>

			<div className="rounded-lg border border-white/10 p-3">
				<h4 className="font-medium mb-3">Reglas de avance</h4>
				<AdvancementRulesEditor parentStage={stage} subStages={children} onChange={(rules) => onChange(stage.id, { config: { ...stage.config, advancement: rules } })} />
			</div>
		</div>
	);
};

function label(kind: StageKind) {
	return kind === 'groups' ? 'Grupos' : kind === 'league' ? 'Liga' : kind === 'knockout' ? 'Eliminación' : 'Compuesta';
}

function defaultName(kind: StageKind) {
	switch (kind) {
		case 'groups':
			return 'Grupos';
		case 'league':
			return 'Liga';
		case 'knockout':
			return 'Copa';
		case 'composed':
			return 'Compuesta';
		default:
			return 'Etapa';
	}
} 