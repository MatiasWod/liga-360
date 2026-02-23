import React from 'react';
import { TournamentForm } from './components/TournamentForm';
import { Home } from '../home/Home';
import { TournamentsList } from '../tournaments-list/TournamentsList';
import { TournamentDetail } from '../tournaments-list/TournamentDetail';
import { Register } from '../auth/Register';
import { Login } from '../auth/Login';

export const App: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
	const [route, setRoute] = React.useState<'home' | 'create' | 'list' | 'detail' | 'register' | 'login'>('home');
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const [navUser, setNavUser] = React.useState<any>(() => {
		try { return JSON.parse(localStorage.getItem('liga360:user') || 'null'); } catch { return null; }
	});
	React.useEffect(() => {
		const i = setInterval(() => {
			try { setNavUser(JSON.parse(localStorage.getItem('liga360:user') || 'null')); } catch {}
		}, 500);
		return () => clearInterval(i);
	}, []);

	if (embedded) {
		return (
			<div className="space-y-4">
				<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-md">
					<div className="flex flex-wrap items-center gap-2">
						<button onClick={() => setRoute('home')} className={`rounded-xl px-3 py-2 text-sm ${route === 'home' ? 'bg-[#66BB6A] text-[#0F2A33]' : 'bg-slate-100 text-slate-700'}`}>Inicio</button>
						{navUser?.type === 'organizer' && (
							<button onClick={() => setRoute('create')} className={`rounded-xl px-3 py-2 text-sm ${route === 'create' ? 'bg-[#66BB6A] text-[#0F2A33]' : 'bg-slate-100 text-slate-700'}`}>Crear torneo</button>
						)}
						<button onClick={() => setRoute('list')} className={`rounded-xl px-3 py-2 text-sm ${route === 'list' ? 'bg-[#66BB6A] text-[#0F2A33]' : 'bg-slate-100 text-slate-700'}`}>Visualizar torneos</button>
					</div>
				</div>
				<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-md">
					{route === 'home' && <Home onNavigate={setRoute} />}
					{route === 'create' && <TournamentForm />}
					{route === 'list' && <TournamentsList onOpen={(id) => { setSelectedId(id); setRoute('detail'); }} />}
					{route === 'detail' && selectedId && <TournamentDetail id={selectedId} onBack={() => setRoute('list')} />}
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-brand-blueDark text-brand-white">
			<header className="border-b border-white/15 bg-black/20 backdrop-blur sticky top-0 z-10">
				<div className="px-4 py-4 flex items-center justify-between">
					<h1 className="text-xl font-semibold tracking-wide">Liga360</h1>
					<HeaderAuth onNavigate={setRoute} />
				</div>
			</header>
			{/* Vistas de autenticación a pantalla completa (sin sidebar) */}
			{(route === 'login' || route === 'register') ? (
				<main className="px-4 py-10 w-full max-w-xl mx-auto">
					{route === 'register' && <Register onRegistered={() => setRoute('home')} onSkip={() => setRoute('home')} />}
					{route === 'login' && <Login onLogged={() => setRoute('home')} onSkip={() => setRoute('home')} />}
				</main>
			) : (
			<div className="md:flex">
				{/* Sidebar pegada a la izquierda */}
				<aside className="hidden md:flex fixed left-0 top-[56px] bottom-0 w-60 border-r border-white/10 bg-white/5 backdrop-blur-sm p-4 flex-col">
					<nav className="space-y-2">
						<button onClick={() => setRoute('home')} className={`w-full text-left px-3 py-2 rounded-lg border ${route==='home' ? 'bg-white/10 border-white/20' : 'border-white/10 hover:border-white/20'}`}>Inicio</button>
						{navUser?.type === 'organizer' && (
							<button onClick={() => setRoute('create')} className={`w-full text-left px-3 py-2 rounded-lg border ${route==='create' ? 'bg-white/10 border-white/20' : 'border-white/10 hover:border-white/20'}`}>Crear torneo</button>
						)}
						<button onClick={() => setRoute('list')} className={`w-full text-left px-3 py-2 rounded-lg border ${route==='list' ? 'bg-white/10 border-white/20' : 'border-white/10 hover:border-white/20'}`}>Visualizar torneos</button>
					</nav>
					<div id="stage-sidebar-slot" className="mt-auto"></div>
				</aside>
				{/* Contenido corre a la derecha del sidebar en md+ */}
				<main className="px-4 py-6 md:ml-60 w-full">
					{route === 'home' && <Home onNavigate={setRoute} />}
					{route === 'create' && <TournamentForm />}
					{route === 'list' && <TournamentsList onOpen={(id) => { setSelectedId(id); setRoute('detail'); }} />}
					{route === 'detail' && selectedId && <TournamentDetail id={selectedId} onBack={() => setRoute('list')} />}
				</main>
			</div>
			)}
		</div>
	);
}; 

const HeaderAuth: React.FC<{ onNavigate: (r: any) => void }> = ({ onNavigate }) => {
	const [user, setUser] = React.useState<any>(() => {
		try { return JSON.parse(localStorage.getItem('liga360:user') || 'null'); } catch { return null; }
	});
	function logout() {
		localStorage.removeItem('liga360:user');
		localStorage.removeItem('liga360:token');
		setUser(null);
		onNavigate('home');
	}
	React.useEffect(() => {
		const i = setInterval(() => {
			try { setUser(JSON.parse(localStorage.getItem('liga360:user') || 'null')); } catch {}
		}, 500);
		return () => clearInterval(i);
	}, []);
	if (user) {
		return (
			<div className="flex items-center gap-3">
				<span className="text-sm opacity-90">Hola, {user.username}</span>
				<button className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20 text-sm" onClick={logout}>Cerrar sesión</button>
			</div>
		);
	}
	return (
		<div className="flex items-center gap-2">
			<button className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20 text-sm" onClick={() => onNavigate('login')}>Iniciar sesión</button>
			<button className="px-3 py-1.5 rounded-md bg-brand-green text-white hover:bg-brand-greenDark text-sm" onClick={() => onNavigate('register')}>Registrarse</button>
		</div>
	);
};