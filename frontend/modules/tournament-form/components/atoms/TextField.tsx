import React from 'react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label: string;
	name?: string;
}

export const TextField: React.FC<TextFieldProps> = ({ label, name, required, ...props }) => {
	const id = React.useId();
	return (
		<label className="flex flex-col gap-1">
			<span className="text-sm opacity-90">{label}{required ? ' *' : ''}</span>
			<input
				id={id}
				name={name}
				className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-green/60 placeholder-white/50"
				{...props}
			/>
		</label>
	);
}; 