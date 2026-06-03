import React from 'react';
import { StageKind } from './StageBuilder';

interface StagePaletteProps {
	onAdd: (kind: StageKind) => void;
}

export const StagePalette: React.FC<StagePaletteProps> = ({ onAdd }) => {
	return (
		<div className="card mt-4 p-4 w-full shadow-sm">
			<h3 className="font-medium mb-3">Añadir nueva etapa</h3>
			<div className="flex flex-wrap items-center gap-2">
				<button type="button" onClick={() => onAdd('groups')} className="btn-primary shadow-sm">Grupos</button>
				<button type="button" onClick={() => onAdd('league')} className="btn-primary shadow-sm">Liga</button>
				<button type="button" onClick={() => onAdd('knockout')} className="btn-primary shadow-sm">Eliminación</button>
			</div>
		</div>
	);
}; 