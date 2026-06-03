import React from 'react';
import type { StageDraft } from '../StageBuilder';

export interface AdvancementRule {
	id: string;
	description: string; // texto libre por ahora
}

interface Props {
	parentStage: StageDraft;
	subStages: StageDraft[];
	onChange: (rules: AdvancementRule[]) => void;
}

export const AdvancementRulesEditor: React.FC<Props> = ({ subStages, onChange }) => {
	const [rules, setRules] = React.useState<AdvancementRule[]>([]);

	function addPreset(preset: 'gold' | 'silver' | 'bronze') {
		const additions: Record<typeof preset, string> = {
			gold: 'Primeros 2 de cada grupo a Liga de Oro (todos contra todos, solo ida)',
			silver: '3°, 4° y 5° a Ligas de Plata (divididos en 3 grupos de 5; avanzan los primeros y el mejor segundo a semis/final)',
			bronze: '6° y 7° a Copa de Bronce (eliminación directa)'
		};
		setRules((prev) => {
			const next = [...prev, { id: crypto.randomUUID(), description: additions[preset] }];
			onChange(next);
			return next;
		});
	}

	function addCustom(desc: string) {
		if (!desc.trim()) return;
		setRules((prev) => {
			const next = [...prev, { id: crypto.randomUUID(), description: desc.trim() }];
			onChange(next);
			return next;
		});
	}

	function remove(id: string) {
		setRules((prev) => {
			const next = prev.filter((r) => r.id !== id);
			onChange(next);
			return next;
		});
	}

	return (
		<div className="space-y-3">
			<div className="text-xs opacity-80">Sub-etapas destino: {subStages.length > 0 ? subStages.map((s) => s.name).join(', ') : '—'}</div>
			<div className="flex flex-wrap gap-2">
				<button type="button" onClick={() => addPreset('gold')} className="px-3 py-1 rounded bg-brand-blue/70 hover:bg-brand-blue text-xs">Agregar preset Oro</button>
				<button type="button" onClick={() => addPreset('silver')} className="px-3 py-1 rounded bg-brand-blue/70 hover:bg-brand-blue text-xs">Agregar preset Plata</button>
				<button type="button" onClick={() => addPreset('bronze')} className="px-3 py-1 rounded bg-brand-blue/70 hover:bg-brand-blue text-xs">Agregar preset Bronce</button>
			</div>
			<AddCustom onAdd={addCustom} />
			<ul className="space-y-2">
				{rules.map((rule) => (
					<li key={rule.id} className="flex items-start justify-between gap-2 rounded bg-white/5 border border-white/10 p-2">
						<p className="text-sm">{rule.description}</p>
						<button type="button" onClick={() => remove(rule.id)} className="text-xs opacity-80 hover:opacity-100">Eliminar</button>
					</li>
				))}
			</ul>
		</div>
	);
};

const AddCustom: React.FC<{ onAdd: (desc: string) => void; }> = ({ onAdd }) => {
	const [value, setValue] = React.useState('');
	return (
		<div className="flex items-center gap-2">
			<input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Agregar regla personalizada" className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-blueLight/60" />
			<button type="button" onClick={() => { onAdd(value); setValue(''); }} className="px-3 py-2 rounded-lg bg-brand-blueLight hover:opacity-90">Agregar</button>
		</div>
	);
}; 