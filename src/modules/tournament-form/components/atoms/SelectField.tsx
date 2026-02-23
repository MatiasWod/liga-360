import React from 'react';

interface Option {
	label: string;
	value: string;
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
	label: string;
	options: Option[];
	name?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({ label, options, name, required, ...props }) => {
	const id = React.useId();
	return (
		<label className="flex flex-col gap-1">
			<span className="text-sm opacity-90">{label}{required ? ' *' : ''}</span>
			<select
				id={id}
				name={name}
				className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-green/60"
				{...props}
			>
				{options.map((opt) => (
					<option key={opt.value} value={opt.value} className="bg-brand-green">{opt.label}</option>
				))}
			</select>
		</label>
	);
}; 