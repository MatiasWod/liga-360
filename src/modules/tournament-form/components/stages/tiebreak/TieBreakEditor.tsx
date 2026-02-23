import React from 'react';

export interface RuleItem { id: string; label: string; }

const DEFAULT_RULES: RuleItem[] = [
	{ id: 'points', label: 'Puntos' },
	{ id: 'gd', label: 'Diferencia de gol' },
	{ id: 'gf', label: 'Goles a favor' },
	{ id: 'ga', label: 'Goles en contra' },
	{ id: 'h2h', label: 'Enfrentamiento directo' },
	{ id: 'fair', label: 'Fair Play' },
	{ id: 'draw', label: 'Sorteo' }
];

interface Props {
	value?: RuleItem[];
	onChange: (rules: RuleItem[]) => void;
}

export const TieBreakEditor: React.FC<Props> = ({ value, onChange }) => {
	const [rules, setRules] = React.useState<RuleItem[]>(value && value.length ? value : DEFAULT_RULES);

	React.useEffect(() => {
		onChange(rules);
	}, [rules]);

	function move(index: number, direction: -1 | 1) {
		const newIndex = index + direction;
		if (newIndex < 0 || newIndex >= rules.length) return;
		const copy = [...rules];
		const [removed] = copy.splice(index, 1);
		copy.splice(newIndex, 0, removed);
		setRules(copy);
	}

	function remove(index: number) {
		setRules((prev) => prev.filter((_, i) => i !== index));
	}

	function add(label: string) {
		if (!label.trim()) return;
		setRules((prev) => [...prev, { id: crypto.randomUUID(), label: label.trim() }]);
	}

	return (
		<div className="space-y-3">
			<ul className="space-y-2">
				{rules.map((rule, index) => (
					<li key={rule.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
						<div className="text-sm">{index + 1}. {rule.label}</div>
						<div className="flex items-center gap-2 text-xs">
							<button type="button" onClick={() => move(index, -1)} className="px-2 py-1 rounded bg-brand-blue/70 hover:bg-brand-blue">↑</button>
							<button type="button" onClick={() => move(index, 1)} className="px-2 py-1 rounded bg-brand-blue/70 hover:bg-brand-blue">↓</button>
							<button type="button" onClick={() => remove(index)} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20">Eliminar</button>
						</div>
					</li>
				))}
			</ul>
			<AddRule onAdd={add} />
		</div>
	);
};

const AddRule: React.FC<{ onAdd: (label: string) => void; }> = ({ onAdd }) => {
	const [value, setValue] = React.useState('');
	return (
		<div className="flex items-center gap-2">
			<input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Nueva regla (opcional)" className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-blueLight/60" />
			<button type="button" onClick={() => { if (value.trim()) { onAdd(value.trim()); setValue(''); } }} className="px-3 py-2 rounded-lg bg-brand-blueLight hover:opacity-90">Agregar</button>
		</div>
	);
}; 