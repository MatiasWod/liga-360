import React from 'react';
import { StageBuilder, type StageDraft, type CrossCompetitionOption } from './stages/StageBuilder';

export interface CompetitionMeta {
	id: string;
	name: string;
	stages: StageDraft[];
}

interface CompetitionsBuilderProps {
	value: CompetitionMeta[];
	onChange: (next: CompetitionMeta[]) => void;
	maxCompetitions?: number;
	maxStagesPerCompetition?: number;
}

export const CompetitionsBuilder: React.FC<CompetitionsBuilderProps> = ({
	value,
	onChange,
	maxCompetitions = 6,
	maxStagesPerCompetition = 8,
}) => {
	const [activeIdx, setActiveIdx] = React.useState(0);
	const competitions = value ?? [];

	React.useEffect(() => {
		if (activeIdx >= competitions.length) {
			setActiveIdx(Math.max(0, competitions.length - 1));
		}
	}, [competitions.length, activeIdx]);

	function setCompetitions(updater: (prev: CompetitionMeta[]) => CompetitionMeta[]) {
		onChange(updater(competitions));
	}

	function addCompetition() {
		if (competitions.length >= maxCompetitions) {
			window.alert(`Máximo de ${maxCompetitions} competiciones permitido (MVP)`);
			return;
		}
		const name = window.prompt('Nombre de la competencia', `Competición ${competitions.length + 1}`);
		if (!name) return;
		const next: CompetitionMeta = {
			id: crypto.randomUUID(),
			name: name.trim(),
			stages: [],
		};
		setCompetitions((prev) => [...prev, next]);
		setActiveIdx(competitions.length);
	}

	function removeCompetition(index: number) {
		setCompetitions((prev) => prev.filter((_, i) => i !== index));
	}

	function updateCompetition(index: number, partial: Partial<CompetitionMeta>) {
		setCompetitions((prev) => prev.map((c, i) => (i === index ? { ...c, ...partial } : c)));
	}

	function onChangeStages(index: number, nextStages: StageDraft[]) {
		updateCompetition(index, { stages: nextStages });
	}

	const crossOptions: CrossCompetitionOption[] = competitions.map((c) => ({
		competitionId: c.id,
		competitionName: c.name,
		stages: c.stages,
	}));

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				{competitions.map((c, i) => (
					<button
						key={c.id}
						type="button"
						onClick={() => setActiveIdx(i)}
						className={`px-3 py-1.5 rounded-md text-sm border inline-flex items-center gap-2 ${i === activeIdx ? 'bg-white/10 border-white/20' : 'bg-transparent border-white/10 hover:border-white/20'}`}
						title={c.name}
					>
						<span>{i + 1}. {c.name}</span>
						<span
							role="button"
							aria-label={`Eliminar ${c.name}`}
							title="Eliminar competencia"
							onClick={(e) => { e.stopPropagation(); removeCompetition(i); }}
							className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full border border-white/20 hover:bg-white/20 text-[10px]"
						>
							×
						</span>
					</button>
				))}
				<button
					type="button"
					onClick={addCompetition}
					className="px-3 py-1.5 rounded-md text-sm bg-brand-green text-white hover:bg-brand-greenDark"
				>
					+ Añadir competencia
				</button>
			</div>

			{competitions.length === 0 ? (
				<div className="rounded-lg border border-dashed border-white/20 p-6 text-sm opacity-80">
					No hay competiciones. Agrega una para comenzar.
				</div>
			) : (
				<div className="space-y-4">
					<div className="grid grid-cols-1 items-end gap-3">
						<label className="flex flex-col gap-1">
							<span className="text-sm opacity-90">Nombre de la competicion</span>
							<input
								type="text"
								value={competitions[activeIdx]?.name ?? ''}
								onChange={(e) => updateCompetition(activeIdx, { name: e.currentTarget.value })}
								className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-green/60 placeholder-white/50 text-sm"
								placeholder="Ej: Apertura, Fase Regular, Copa de Invierno…"
							/>
						</label>
					</div>

					<StageBuilder
						value={competitions[activeIdx]?.stages}
						onChangeStages={(next) => onChangeStages(activeIdx, next)}
						crossOptions={crossOptions}
						maxStages={maxStagesPerCompetition}
					/>
				</div>
			)}
		</div>
	);
};


