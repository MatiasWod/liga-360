import React from 'react';
import Select from 'react-select';

interface Option {
	label: string;
	value: string;
}

interface SelectFieldProps {
	label: string;
	options: Option[];
	name: string;
	value: string;
	onChange: (value: string) => void;
	required?: boolean;
	isDisabled?: boolean;
	/** Valores de opción que se muestran con estilo de acción (ej. crear nuevo). */
	actionOptionValues?: string[];
}

export const SelectField: React.FC<SelectFieldProps> = ({
	label,
	options,
	name,
	value,
	onChange,
	required,
	isDisabled,
	actionOptionValues = [],
}) => {
	const id = React.useId();
	const selected = React.useMemo(
		() => options.find((opt) => opt.value === value) ?? null,
		[options, value]
	);

	return (
		<label className="flex flex-col gap-1">
			<span className="text-sm font-medium opacity-90">{label}{required ? ' *' : ''}</span>
			<Select
				inputId={id}
				instanceId={`${name}-${id}`}
				name={name}
				options={options}
				value={selected}
				onChange={(option) => onChange(option?.value ?? '')}
				isDisabled={isDisabled}
				isSearchable={false}
				classNamePrefix="liga-select"
				styles={{
					control: (base, state) => ({
						...base,
						cursor: 'pointer',
						minHeight: 42,
						borderRadius: 8,
						borderColor: state.isFocused ? 'rgba(102, 187, 106, 0.8)' : 'rgba(255, 255, 255, 0.1)',
						backgroundColor: 'rgba(255, 255, 255, 0.1)',
						boxShadow: state.isFocused ? '0 0 0 2px rgba(46, 125, 50, 0.45)' : 'none',
						':hover': {
							borderColor: 'rgba(102, 187, 106, 0.6)',
						},
					}),
					valueContainer: (base) => ({
						...base,
						padding: '0 10px',
					}),
					singleValue: (base) => ({
						...base,
						color: 'rgba(255, 255, 255, 0.95)',
						fontSize: '0.875rem',
						fontWeight: 500,
					}),
					placeholder: (base) => ({
						...base,
						color: 'rgba(255, 255, 255, 0.5)',
						fontSize: '0.875rem',
					}),
					indicatorSeparator: () => ({ display: 'none' }),
					dropdownIndicator: (base, state) => ({
						...base,
						cursor: 'pointer',
						color: state.isFocused ? '#66BB6A' : 'rgba(255, 255, 255, 0.55)',
						':hover': {
							cursor: 'pointer',
							color: '#66BB6A',
						},
					}),
					menu: (base) => ({
						...base,
						borderRadius: 10,
						overflow: 'hidden',
						border: '1px solid rgba(255, 255, 255, 0.12)',
						backgroundColor: '#0F2A33',
						boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
					}),
					menuList: (base) => ({
						...base,
						paddingTop: 4,
						paddingBottom: 4,
						backgroundColor: '#0F2A33',
					}),
					option: (base, state) => {
						const isAction = actionOptionValues.includes(String(state.data?.value ?? ''));
						return {
						...base,
						cursor: 'pointer',
						fontSize: '0.875rem',
						fontWeight: isAction ? 600 : state.isSelected ? 600 : 500,
						color: isAction
							? '#66BB6A'
							: state.isSelected
								? '#ffffff'
								: 'rgba(255, 255, 255, 0.9)',
						backgroundColor: isAction
							? 'rgba(102, 187, 106, 0.12)'
							: state.isSelected
								? '#2E7D32'
								: state.isFocused
									? 'rgba(102, 187, 106, 0.18)'
									: 'transparent',
						borderTop: isAction ? '1px solid rgba(255, 255, 255, 0.08)' : undefined,
						marginTop: isAction ? 4 : undefined,
						':active': {
							backgroundColor: 'rgba(102, 187, 106, 0.28)',
						},
					};
					},
				}}
			/>
		</label>
	);
}; 