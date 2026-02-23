import React from 'react';

interface SectionProps {
	title: string;
	subtitle?: string;
	children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({ title, subtitle, children }) => {
	return (
		<section className="card p-5 md:p-6">
			<div className="mb-4">
				<h2 className="text-lg font-semibold tracking-wide">{title}</h2>
				{subtitle && <p className="text-sm opacity-80 mt-1">{subtitle}</p>}
			</div>
			{children}
		</section>
	);
}; 