import React from 'react';
import { buildScheduleFromStage, TournamentSchedule } from '../../components/tournament-schedule';

type MatchRow = {
	id: string;
	round?: number | null;
	leg?: number | null;
	slotIndex?: number | null;
	fixtureCode?: string | null;
	groupId?: string | null;
	homeAssignedInscription?: { inscriptionId: string; displayName: string } | null;
	awayAssignedInscription?: { inscriptionId: string; displayName: string } | null;
};

type GroupBlock = {
	id: string;
	name: string;
	order: number;
	matches?: MatchRow[];
};

type Stage = {
	id: string;
	name: string;
	order: number;
	format: 'league' | 'groups' | 'elimination';
	matches?: MatchRow[];
	groups?: GroupBlock[];
};
type Competition = { id: string; name: string; order: number; stages: Stage[] };
type Tournament = {
	id: string;
	name: string;
	venue?: string | null;
	organizer?: string | null;
	participantType?: string | null;
	status?: string | null;
	competitions: Competition[];
};

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

function TournamentIcon() {
	return (
		<svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" aria-hidden="true">
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

export const TournamentDetail: React.FC<{ id: string; onBack: () => void }> = ({ id, onBack }) => {
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [t, setT] = React.useState<Tournament | null>(null);

	React.useEffect(() => {
		async function load() {
			setLoading(true);
			setError(null);
			try {
				const query = `
					query($id:ID!){
						tournament(id:$id){
							id name venue organizer participantType status
							competitions {
								id name order
								stages {
									id name order format
									matches {
										id round leg slotIndex fixtureCode groupId
										homeAssignedInscription { inscriptionId displayName }
										awayAssignedInscription { inscriptionId displayName }
									}
									groups {
										id name order
										matches {
											id round leg slotIndex fixtureCode groupId
											homeAssignedInscription { inscriptionId displayName }
											awayAssignedInscription { inscriptionId displayName }
										}
									}
								}
							}
						}
					}
				`;
				const res = await fetch('http://localhost:4000/graphql', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ query, variables: { id } }),
				});
				const json = await res.json();
				if (json.errors) throw new Error(json.errors?.[0]?.message || 'GraphQL error');
				setT(json.data.tournament as Tournament);
			} catch (e: any) {
				setError(e?.message || 'Error al cargar torneo');
			} finally {
				setLoading(false);
			}
		}
		load();
	}, [id]);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<button onClick={onBack} className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20 text-sm">← Volver</button>
			</div>

			{loading && <div className="text-sm opacity-80">Cargando...</div>}
			{error && <div className="text-sm text-red-300">{error}</div>}
			{!loading && !error && t && (
				<div className="space-y-6">
					<div className="rounded-xl border border-white/10 bg-white/10 p-6">
						<div className="flex items-center gap-2 mb-2">
							<span className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-white/10 bg-white/5">
								<TournamentIcon />
							</span>
							<h2 className="text-2xl font-semibold">{t.name}</h2>
						</div>
						<div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm opacity-90">
							<div><span className="opacity-70">Ubicación:</span> {t.venue || 'N/D'}</div>
							<div><span className="opacity-70">Organizador:</span> {t.organizer || 'N/D'}</div>
							<div><span className="opacity-70">Participantes:</span> {t.participantType || 'N/D'}</div>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{t.competitions.map((c) => (
							<div key={c.id} className="rounded-xl border border-white/10 bg-white/10 p-5">
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-2">
										<span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-white/10 bg-white/5">
											<CompetitionIcon className="w-3.5 h-3.5" />
										</span>
										<h3 className="text-sm font-medium">{c.name}</h3>
									</div>
									<span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5">#{c.order}</span>
								</div>
								{c.stages.length === 0 ? (
									<div className="text-xs opacity-70">Sin etapas</div>
								) : (
									<ul className="space-y-2">
										{c.stages
											.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
											.map((s) => (
												<li key={s.id} className="flex items-center gap-2 text-sm">
													<span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-white/10 bg-white/5">
														<StageIcon format={s.format} />
													</span>
													<span className="opacity-90">{s.order}. {s.name}</span>
												</li>
											))}
									</ul>
								)}
							</div>
						))}
					</div>

					{String(t.status || '').toLowerCase() === 'published' ? (
						<div className="rounded-xl border border-white/10 bg-white/10 p-6">
							<h3 className="text-lg font-semibold mb-3">Fixture</h3>
							<div className="space-y-8">
								{t.competitions
									.slice()
									.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
									.map((c) => (
										<div key={`fix-${c.id}`}>
											<p className="text-sm font-medium text-white/90 mb-3">{c.name}</p>
											<div className="space-y-6">
												{c.stages
													.filter((s) => s.format === 'league' || s.format === 'elimination' || s.format === 'groups')
													.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
													.map((s) => {
														const built = buildScheduleFromStage({
															format: s.format,
															matches: s.matches,
															groups: s.groups,
														});
														if (!built) return null;
														const has =
															s.format === 'groups'
																? (s.groups || []).some((g) => (g.matches || []).length > 0)
																: (s.matches || []).length > 0;
														if (!has) return null;
														return (
															<div key={s.id} className="mb-2">
																<p className="text-xs text-white/60 mb-2">
																	{s.order}. {s.name}
																	{s.format === 'league'
																		? ' · Liga'
																		: s.format === 'groups'
																			? ' · Grupos'
																			: ' · Eliminación'}
																</p>
																<TournamentSchedule type={built.type} data={built.data} theme="dark" />
															</div>
														);
													})}
											</div>
										</div>
									))}
							</div>
						</div>
					) : null}
				</div>
			)}
		</div>
	);
};


