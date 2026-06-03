import React from 'react';

export const Pill: React.FC<React.PropsWithChildren> = ({ children }) => {
	return (
		<span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs">
			{children}
		</span>
	);
}; 