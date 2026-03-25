import React from 'react';

type Stage = { id: string; name: string; order: number; format: 'league' | 'groups' | 'elimination' };
type Competition = { id: string; name: string; order: number; stages: Stage[] };
type Tournament = {
	id: string;
	name: string;
	venue?: string | null;
	organizer?: string | null;
	participantType?: string | null;
	inscriptionMode?: 'public' | 'invitation' | null;
	competitions: Competition[];
};

export const TournamentsList: React.FC<{
	onOpen?: (id: string, name?: string) => void;
	organizerFilter?: string;
	inscriptionModeFilter?: 'public' | 'invitation';
	participantTypeFilter?: 'teams' | 'individuals';
	idsFilter?: string[];
	excludeIdsFilter?: string[];
}> = ({ onOpen, organizerFilter, inscriptionModeFilter, participantTypeFilter, idsFilter, excludeIdsFilter }) => {
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [items, setItems] = React.useState<Tournament[]>([]);
	const currentOrganizer = (organizerFilter || '').trim().toLowerCase();

	function StageIcon({ format }: { format: Stage['format'] }) {
		const common = 'w-3.5 h-3.5';
		switch (format) {
			case 'groups':
				return (
					<svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<rect x="3" y="3" width="7" height="7" rx="1"></rect>
						<rect x="14" y="3" width="7" height="7" rx="1"></rect>
						<rect x="3" y="14" width="7" height="7" rx="1"></rect>
						<rect x="14" y="14" width="7" height="7" rx="1"></rect>
					</svg>
				);
			case 'league':
				return (
					<svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<rect x="3" y="4" width="18" height="3" rx="1"></rect>
						<rect x="3" y="10.5" width="18" height="3" rx="1"></rect>
						<rect x="3" y="17" width="18" height="3" rx="1"></rect>
					</svg>
				);
			default:
				return (
					<svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M6 4h2v16H6zM16 4h2v16h-2zM8 12h8v2H8z"></path>
					</svg>
				);
		}
	}
	function CompetitionIcon({ className = 'w-4 h-4' }: { className?: string }) {
		return (
			<svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
				<path d="M5 3h14v2h2v3a5 5 0 0 1-5 5h-1.1A6.002 6.002 0 0 1 13 16v2h3v2H8v-2h3v-2c0-2.22-1.21-4.16-3.02-5H7a5 5 0 0 1-5-5V5h2V3zm0 4a3 3 0 0 0 3 3h.17A7.04 7.04 0 0 1 7 8V5H5v2zm12-2v3c0 .7-.12 1.37-.34 2H16a3 3 0 0 0 3-3V5h-2z"></path>
			</svg>
		);
	}
	function TournamentIcon({ className = 'w-6 h-6' }: { className?: string }) {
		return (
			<svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
				<g transform="translate(0,2) scale(0.8)">
					<path d="M5 3h10v2h2v3a4 4 0 0 1-4 4h-.9A5 5 0 0 1 11 16v2h3v2H8v-2h3v-2a5 5 0 0 1-3.02-4H7a4 4 0 0 1-4-4V5h2V3z"></path>
				</g>
				<g transform="translate(8,0) scale(0.7)">
					<path d="M5 3h10v2h2v3a4 4 0 0 1-4 4h-.9A5 5 0 0 1 11 16v2h3v2H8v-2h3v-2a5 5 0 0 1-3.02-4H7a4 4 0 0 1-4-4V5h2V3z"></path>
				</g>
				<g transform="translate(14,2) scale(0.8)">
					<path d="M5 3h10v2h2v3a4 4 0 0 1-4 4h-.9A5 5 0 0 1 11 16v2h3v2H8v-2h3v-2a5 5 0 0 1-3.02-4H7a4 4 0 0 1-4-4V5h2V3z"></path>
				</g>
			</svg>
		);
	}

	function normalizeParticipantType(value: string | null | undefined): 'teams' | 'individuals' {
		const raw = String(value || '').trim().toLowerCase();
		if (raw === 'team' || raw === 'teams') return 'teams';
		if (raw === 'participant' || raw === 'participants' || raw === 'individual' || raw === 'individuals') return 'individuals';
		return 'teams';
	}

	async function load() {
			setLoading(true); setError(null);
			try {
				const query = `
					{ tournaments { id name venue organizer participantType inscriptionMode competitions { id name order stages { id name order format } } } }
				`;
				const res = await fetch('http://localhost:4000/graphql', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ query })
				});
				const json = await res.json();
				if (json.errors) throw new Error(json.errors?.[0]?.message || 'GraphQL error');
				const all = json.data.tournaments as Tournament[];
				let filtered = all;
				if (organizerFilter?.trim()) {
					const needle = organizerFilter.trim().toLowerCase();
					filtered = filtered.filter((t) => (t.organizer || '').trim().toLowerCase() === needle);
				}
				if (inscriptionModeFilter) {
					filtered = filtered.filter((t) => (t.inscriptionMode || 'public') === inscriptionModeFilter);
				}
				if (participantTypeFilter) {
					filtered = filtered.filter((t) => normalizeParticipantType(t.participantType) === participantTypeFilter);
				}
				if (Array.isArray(idsFilter)) {
					const allowed = new Set(idsFilter.map((id) => String(id || '')));
					filtered = filtered.filter((t) => allowed.has(String(t.id || '')));
				}
				if (Array.isArray(excludeIdsFilter) && excludeIdsFilter.length > 0) {
					const blocked = new Set(excludeIdsFilter.map((id) => String(id || '')));
					filtered = filtered.filter((t) => !blocked.has(String(t.id || '')));
				}
				setItems(filtered);
			} catch (e: any) {
				setError(e?.message || 'Error al cargar torneos');
			} finally {
				setLoading(false);
			}
	}

	async function deleteTournament(id: string) {
		const token = localStorage.getItem('liga360:token');
		const res = await fetch('http://localhost:4000/graphql', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: JSON.stringify({
				query: `mutation DeleteTournament($id: ID!) { deleteTournament(id: $id) }`,
				variables: { id },
			}),
		});
		const json = await res.json();
		if (json.errors) throw new Error(json.errors?.[0]?.message || 'No se pudo eliminar torneo');
	}

	React.useEffect(() => {
		load();
	}, [organizerFilter, inscriptionModeFilter, participantTypeFilter, idsFilter, excludeIdsFilter]);

	if (loading) return <div className="text-sm opacity-80">Cargando torneos…</div>;
	if (error) return <div className="text-sm text-red-300">{error}</div>;

	if (items.length === 0) {
		return <div className="text-sm opacity-80">Aún no hay torneos creados.</div>;
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			{items.map((t) => (
				<div
					key={t.id}
					className="card p-6 shadow-sm hover:shadow transition-shadow cursor-pointer"
					onClick={() => onOpen?.(t.id, t.name)}
				>
					<header className="flex items-start justify-between gap-3 mb-4">
						<div>
							<div className="flex items-center gap-2">
								<span className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-white/10 bg-white/5">
									<TournamentIcon />
								</span>
								<h3 className="text-xl font-semibold">{t.name}</h3>
							</div>
							<div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm opacity-90 mt-2">
								<div><span className="opacity-70">Ubicación:</span> {t.venue || 'N/D'}</div>
								<div><span className="opacity-70">Organizador:</span> {t.organizer || 'N/D'}</div>
								<div><span className="opacity-70">Participantes:</span> {t.participantType || 'N/D'}</div>
							</div>
						</div>
						<div className="flex flex-col items-end gap-2">
							<span className="text-[10px] px-2 py-1 rounded-full border border-white/10 bg-white/5 self-start">{t.id}</span>
							{currentOrganizer && (t.organizer || '').trim().toLowerCase() === currentOrganizer && (
								<button
									type="button"
									className="rounded-md border border-red-300 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
									onClick={async (e) => {
										e.stopPropagation();
										const ok = window.confirm(`¿Eliminar torneo "${t.name}"? Esta acción no se puede deshacer.`);
										if (!ok) return;
										try {
											await deleteTournament(t.id);
											await load();
										} catch (err: any) {
											setError(err?.message || 'No se pudo eliminar torneo');
										}
									}}
								>
									Eliminar
								</button>
							)}
						</div>
					</header>

					{/* Competencias como cards dentro del torneo */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{t.competitions.map((c) => (
							<div
								key={c.id}
								className="rounded-xl border border-white/10 bg-white/10 p-4 hover:bg-white/15 transition-colors"
							>
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-2">
										<span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-white/10 bg-white/5">
											<CompetitionIcon className="w-3.5 h-3.5" />
										</span>
										<h4 className="text-sm font-medium">{c.name}</h4>
									</div>
									<span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5">#{c.order}</span>
								</div>
								{/* Stages como chips con iconitos */}
								{c.stages.length === 0 ? (
									<div className="text-xs opacity-70">Sin etapas</div>
								) : (
									<div className="flex flex-wrap gap-2">
										{c.stages
											.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
											.map((s) => (
												<span
													key={s.id}
													title={`${s.name} • ${s.format}`}
													className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-white/10 bg-white/5 text-xs"
												>
													<span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-white/10 bg-white/5">
														<StageIcon format={s.format} />
													</span>
													<span className="opacity-90">{s.order}. {s.name}</span>
												</span>
											))}
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
};


