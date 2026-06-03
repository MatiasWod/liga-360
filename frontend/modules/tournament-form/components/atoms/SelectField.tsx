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
}

export const SelectField: React.FC<SelectFieldProps> = ({
	label,
	options,
	name,
	value,
	onChange,
	required,
	isDisabled,
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
						borderColor: state.isFocused ? '#66BB6A' : '#cbd5e1',
						backgroundColor: '#ffffff',
						boxShadow: state.isFocused ? '0 0 0 2px rgba(102, 187, 106, 0.25)' : 'none',
						':hover': {
							borderColor: '#66BB6A',
						},
					}),
					valueContainer: (base) => ({
						...base,
						padding: '0 10px',
					}),
					singleValue: (base) => ({
						...base,
						color: '#0F2A33',
						fontSize: '0.875rem',
						fontWeight: 500,
					}),
					placeholder: (base) => ({
						...base,
						color: '#64748b',
						fontSize: '0.875rem',
					}),
					indicatorSeparator: () => ({ display: 'none' }),
					dropdownIndicator: (base, state) => ({
						...base,
						cursor: 'pointer',
						color: state.isFocused ? '#2E7D32' : '#64748b',
						':hover': {
							cursor: 'pointer',
							color: '#2E7D32',
						},
					}),
					menu: (base) => ({
						...base,
						borderRadius: 10,
						overflow: 'hidden',
						border: '1px solid #e2e8f0',
						boxShadow: '0 8px 20px rgba(15, 42, 51, 0.12)',
					}),
					menuList: (base) => ({
						...base,
						paddingTop: 4,
						paddingBottom: 4,
					}),
					option: (base, state) => ({
						...base,
						cursor: 'pointer',
						fontSize: '0.875rem',
						fontWeight: state.isSelected ? 600 : 500,
						color: state.isSelected ? '#ffffff' : '#0F2A33',
						backgroundColor: state.isSelected
							? '#2E7D32'
							: state.isFocused
								? '#E8F5E9'
								: '#ffffff',
						':active': {
							backgroundColor: '#C8E6C9',
						},
					}),
				}}
			/>
		</label>
	);
}; 