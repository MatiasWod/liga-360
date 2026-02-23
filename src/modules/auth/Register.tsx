import React from 'react';

type Mode = 'team' | 'participant' | 'organizer';

export const Register: React.FC<{ onRegistered?: (user: any) => void; onSkip?: () => void }> = ({ onRegistered, onSkip }) => {
	const [mode, setMode] = React.useState<Mode>('team');
	const [username, setUsername] = React.useState('');
	const [password, setPassword] = React.useState('');
	const [name, setName] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [msg, setMsg] = React.useState<string | null>(null);
	const [err, setErr] = React.useState<string | null>(null);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true); setMsg(null); setErr(null);
		try {
			const res = await fetch('http://localhost:4003/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode, username, password, name })
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json?.error || 'Error de registro');
			// Autologin real para guardar JWT válido y evitar tokens placeholder inválidos.
			const loginRes = await fetch('http://localhost:4003/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});
			const loginJson = await loginRes.json();
			if (!loginRes.ok) {
				// Si el autologin falla, no dejamos token inválido.
				localStorage.removeItem('liga360:token');
				localStorage.setItem('liga360:user', JSON.stringify(json.user));
				setMsg(`Usuario creado (#${json.user?.id}) como ${json.user?.type}. Iniciá sesión para continuar.`);
				onRegistered?.(json.user);
				return;
			}
			localStorage.setItem('liga360:token', loginJson.token);
			localStorage.setItem('liga360:user', JSON.stringify(loginJson.user));
			setMsg(`Usuario creado e ingresado como ${loginJson.user?.username}`);
			onRegistered?.(loginJson.user);
			setUsername(''); setPassword(''); setName('');
		} catch (e: any) {
			setErr(e?.message || 'Error');
		} finally {
			setLoading(false);
		}
	}

	return (
		<form className="space-y-5" onSubmit={onSubmit}>
			<div className="rounded-xl border border-white/10 bg-white/10 p-5">
				<h2 className="text-lg font-semibold mb-3">Registro</h2>
				<div className="flex gap-2 mb-4">
					<button type="button" onClick={() => setMode('team')} className={`px-3 py-1.5 rounded-md border ${mode==='team' ? 'bg-white/10 border-white/20' : 'border-white/10 hover:border-white/20'}`}>Equipo</button>
					<button type="button" onClick={() => setMode('participant')} className={`px-3 py-1.5 rounded-md border ${mode==='participant' ? 'bg-white/10 border-white/20' : 'border-white/10 hover:border-white/20'}`}>Participante</button>
					<button type="button" onClick={() => setMode('organizer')} className={`px-3 py-1.5 rounded-md border ${mode==='organizer' ? 'bg-white/10 border-white/20' : 'border-white/10 hover:border-white/20'}`}>Organizador</button>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<label className="flex flex-col gap-1">
						<span className="text-sm opacity-90">Nombre de {mode === 'team' ? 'equipo' : mode === 'participant' ? 'participante' : 'organizador'}</span>
						<input value={name} onChange={(e) => setName(e.currentTarget.value)} className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-green/60 placeholder-white/50" placeholder={mode === 'team' ? 'Ej: Tigres FC' : mode === 'participant' ? 'Ej: Juan Perez' : 'Ej: Liga 360'} />
					</label>
					<label className="flex flex-col gap-1">
						<span className="text-sm opacity-90">Usuario</span>
						<input value={username} onChange={(e) => setUsername(e.currentTarget.value)} className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-green/60 placeholder-white/50" placeholder="usuario" />
					</label>
					<label className="flex flex-col gap-1">
						<span className="text-sm opacity-90">Contraseña</span>
						<input type="password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-green/60 placeholder-white/50" placeholder="********" />
					</label>
				</div>
				<div className="pt-4 flex items-center gap-2 justify-end">
					<button type="button" onClick={onSkip} className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-sm">Continuar sin registrarme</button>
					<button type="submit" disabled={loading} className="btn-primary">{loading ? 'Enviando…' : 'Crear usuario'}</button>
				</div>
				{msg && <div className="text-sm text-green-300 mt-2">{msg}</div>}
				{err && <div className="text-sm text-red-300 mt-2">{err}</div>}
			</div>
		</form>
	);
};


