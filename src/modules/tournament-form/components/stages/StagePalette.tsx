import React from 'react';
import { createPortal } from 'react-dom';
import { StageKind } from './StageBuilder';

interface StagePaletteProps {
	onAdd: (kind: StageKind) => void;
}

export const StagePalette: React.FC<StagePaletteProps> = ({ onAdd }) => {
	const [bottomPx, setBottomPx] = React.useState<number>(24);
	const [sidebarSlot, setSidebarSlot] = React.useState<HTMLElement | null>(null);

	React.useEffect(() => {
		// Si existe un slot en la sidebar, lo usamos y no necesitamos posición fija.
		const slot = document.getElementById('stage-sidebar-slot');
		if (slot) {
			setSidebarSlot(slot as HTMLElement);
			return;
		}
		// Fallback: mantener comportamiento fijo inferior si no hay slot.
		function updatePosition() {
			const container = document.getElementById('stage-builder-root');
			if (!container) { setBottomPx(24); return; }
			const rect = container.getBoundingClientRect();
			const viewportBottom = window.innerHeight;
			const required = Math.max(24, viewportBottom - rect.bottom + 24);
			setBottomPx(required);
		}
		updatePosition();
		window.addEventListener('scroll', updatePosition, { passive: true });
		window.addEventListener('resize', updatePosition);
		return () => {
			window.removeEventListener('scroll', updatePosition);
			window.removeEventListener('resize', updatePosition);
		};
	}, []);

	const node = (
		<div
			className={
				sidebarSlot
					? 'card p-4 w-full shadow-sm'
					: 'card p-4 fixed z-50 shadow-lg w-64 max-w-[90vw] left-4 md:left-6'
			}
			style={sidebarSlot ? undefined : { bottom: bottomPx }}
		>
			<h3 className="font-medium mb-3">Añadir nueva etapa</h3>
			<div className="grid grid-cols-1 gap-2">
				<button type="button" onClick={() => onAdd('groups')} className="w-full btn-primary shadow-sm">Grupos</button>
				<button type="button" onClick={() => onAdd('league')} className="w-full btn-primary shadow-sm">Liga</button>
				<button type="button" onClick={() => onAdd('knockout')} className="w-full btn-primary shadow-sm">Eliminación</button>
			</div>
		</div>
	);
	// Si hay slot de sidebar, montamos allí; si no, al body como flotante.
	return createPortal(node, sidebarSlot ?? document.body);
}; 