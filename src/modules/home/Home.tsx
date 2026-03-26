import React from 'react';
import { readSessionUser } from '../../services/teamsApi';

interface HomeProps {
	onNavigate: (route: 'home' | 'create' | 'list' | 'register' | 'login') => void;
}

export const Home: React.FC<HomeProps> = ({ onNavigate }) => {
	const user = React.useMemo(() => readSessionUser(), []);
	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-white/10 bg-white/10 p-6">
				<h2 className="text-2xl font-semibold mb-2">Bienvenido, {user?.username || 'Usuario'}</h2>
				<p className="opacity-80">Elegí una acción para empezar.</p>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{user?.type === 'organizer' && (
					<button className="card p-6 text-left hover:bg-white/15 transition-colors" onClick={() => onNavigate('create')}>
						<h3 className="text-lg font-medium mb-1">Crear torneo</h3>
						<p className="text-sm opacity-80">Definí un torneo nuevo con sus competiciones y etapas.</p>
					</button>
				)}
				<button className="card p-6 text-left hover:bg-white/15 transition-colors" onClick={() => onNavigate('list')}>
					<h3 className="text-lg font-medium mb-1">Visualizar torneos</h3>
					<p className="text-sm opacity-80">Explorá los torneos creados y su estructura.</p>
				</button>
			</div>
		</div>
	);
};


