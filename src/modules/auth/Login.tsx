import React from 'react';
import { login } from '../../services/teamsApi';

export const Login: React.FC<{ onLogged?: (user: any) => void; onSkip?: () => void }> = ({ onLogged, onSkip }) => {
	const [username, setUsername] = React.useState('');
	const [password, setPassword] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [msg, setMsg] = React.useState<string | null>(null);
	const [err, setErr] = React.useState<string | null>(null);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true); setMsg(null); setErr(null);
		try {
			const user = await login(username, password);
			setMsg(`Bienvenido ${user?.username || user?.fullName || username}`);
			onLogged?.(user);
		} catch (e: any) {
			setErr(e?.message || 'Error');
		} finally {
			setLoading(false);
		}
	}

	return (
		<form className="space-y-5" onSubmit={onSubmit}>
			<div className="rounded-xl border border-white/10 bg-white/10 p-5">
				<h2 className="text-lg font-semibold mb-3">Iniciar sesión</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
					<button type="button" onClick={onSkip} className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-sm">Continuar sin iniciar sesión</button>
					<button type="submit" disabled={loading} className="btn-primary">{loading ? 'Ingresando…' : 'Ingresar'}</button>
				</div>
				{msg && <div className="text-sm text-green-300 mt-2">{msg}</div>}
				{err && <div className="text-sm text-red-300 mt-2">{err}</div>}
			</div>
		</form>
	);
};


