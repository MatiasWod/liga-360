import React from 'react';
import Select from 'react-select';
import { createCompetitionSeries, type CompetitionSeries } from '../../../services/tournaments/series';
import { deriveSeriesSlugFromName } from '../utils/seriesSlug';

const CREATE_VALUE = '__create__';

type SeriesOption = { label: string; value: string };

interface SeriesSelectFieldProps {
	label: string;
	value: string;
	sport: string;
	seriesOptions: CompetitionSeries[];
	onChange: (seriesId: string) => void;
	onSeriesOptionsChange: (next: CompetitionSeries[]) => void;
}

function buildOptions(seriesOptions: CompetitionSeries[]): SeriesOption[] {
	return [
		{ label: 'Sin serie', value: '' },
		...seriesOptions.map((s) => ({ label: s.name, value: s.id })),
		{ label: '+ Crear nueva serie…', value: CREATE_VALUE },
	];
}

export const SeriesSelectField: React.FC<SeriesSelectFieldProps> = ({
	label,
	value,
	sport,
	seriesOptions,
	onChange: selectSeriesId,
	onSeriesOptionsChange,
}) => {
	const id = React.useId();
	const inputRef = React.useRef<HTMLInputElement>(null);
	const [creatingMode, setCreatingMode] = React.useState(false);
	const [draftName, setDraftName] = React.useState('');
	const [saving, setSaving] = React.useState(false);
	const [error, setError] = React.useState('');

	const options = React.useMemo(() => buildOptions(seriesOptions), [seriesOptions]);
	const selected = React.useMemo(
		() => options.find((opt) => opt.value === value) ?? null,
		[options, value]
	);

	React.useEffect(() => {
		if (creatingMode) inputRef.current?.focus();
	}, [creatingMode]);

	function cancelCreate() {
		setCreatingMode(false);
		setDraftName('');
		setError('');
	}

	async function handleCreate() {
		const trimmedName = draftName.trim();
		if (!trimmedName) {
			setError('Ingresá un nombre para la serie');
			return;
		}
		const slug = deriveSeriesSlugFromName(trimmedName);
		if (!slug) {
			setError('El nombre no genera un identificador válido');
			return;
		}
		setSaving(true);
		setError('');
		try {
			const created = await createCompetitionSeries({ name: trimmedName, slug, sport });
			const nextOptions = seriesOptions.some((row) => row.id === created.id)
				? seriesOptions
				: [...seriesOptions, created];
			onSeriesOptionsChange(nextOptions);
			selectSeriesId(created.id);
			cancelCreate();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'No se pudo crear la serie');
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="flex flex-col gap-1">
			<span className="text-sm font-medium opacity-90">{label}</span>
			<Select<SeriesOption>
				inputId={id}
				instanceId={`series-${id}`}
				options={options}
				value={creatingMode ? null : selected}
				isSearchable={false}
				classNamePrefix="liga-select"
				onChange={(option) => {
					if (!option) return;
					if (option.value === CREATE_VALUE) {
						setCreatingMode(true);
						return;
					}
					cancelCreate();
					selectSeriesId(option.value);
				}}
				styles={{
					control: (base, state) => ({
						...base,
						cursor: 'pointer',
						minHeight: 42,
						borderRadius: 8,
						borderColor: state.isFocused ? 'rgba(102, 187, 106, 0.8)' : 'rgba(255, 255, 255, 0.1)',
						backgroundColor: 'rgba(255, 255, 255, 0.1)',
						boxShadow: state.isFocused ? '0 0 0 2px rgba(46, 125, 50, 0.45)' : 'none',
						':hover': { borderColor: 'rgba(102, 187, 106, 0.6)' },
					}),
					placeholder: (base) => ({
						...base,
						color: 'rgba(255, 255, 255, 0.4)',
						fontSize: '0.875rem',
					}),
					singleValue: (base) => ({
						...base,
						color: 'rgba(255, 255, 255, 0.95)',
						fontSize: '0.875rem',
						fontWeight: 500,
					}),
					menu: (base) => ({
						...base,
						borderRadius: 10,
						overflow: 'hidden',
						border: '1px solid rgba(255, 255, 255, 0.12)',
						backgroundColor: '#0F2A33',
						zIndex: 20,
					}),
					menuList: (base) => ({
						...base,
						paddingTop: 4,
						paddingBottom: 4,
						backgroundColor: '#0F2A33',
					}),
					option: (base, state) => {
						const isCreate = (state.data as SeriesOption).value === CREATE_VALUE;
						return {
							...base,
							cursor: 'pointer',
							fontSize: '0.875rem',
							fontWeight: isCreate ? 600 : state.isSelected ? 600 : 500,
							color: isCreate ? '#66BB6A' : state.isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.9)',
							backgroundColor: isCreate
								? 'rgba(102, 187, 106, 0.12)'
								: state.isSelected
									? '#2E7D32'
									: state.isFocused
										? 'rgba(102, 187, 106, 0.18)'
										: 'transparent',
							borderTop: isCreate ? '1px solid rgba(255, 255, 255, 0.08)' : undefined,
							marginTop: isCreate ? 4 : undefined,
						};
					},
				}}
			/>

			{creatingMode && (
				<div className="mt-1 p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
					<p className="text-xs font-semibold text-brand-greenAccent">Nueva serie</p>
					<input
						ref={inputRef}
						type="text"
						value={draftName}
						placeholder='Ej: "Copa Municipal"'
						disabled={saving}
						className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green/60 placeholder-white/50"
						onChange={(e) => {
							setDraftName(e.currentTarget.value);
							setError('');
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter') { e.preventDefault(); void handleCreate(); }
							if (e.key === 'Escape') cancelCreate();
						}}
					/>
					{error && <p className="text-xs text-red-300">{error}</p>}
					<div className="flex justify-end gap-2">
						<button
							type="button"
							className="rounded-lg px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary"
							disabled={saving}
							onClick={cancelCreate}
						>
							Cancelar
						</button>
						<button
							type="button"
							className="rounded-lg bg-brand-green px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-greenDark disabled:opacity-60"
							disabled={saving}
							onClick={() => void handleCreate()}
						>
							{saving ? 'Creando…' : 'Crear y seleccionar'}
						</button>
					</div>
				</div>
			)}
		</div>
	);
};
