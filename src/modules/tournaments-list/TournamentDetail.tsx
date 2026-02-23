import React from 'react';
import {
	createManualTeamInscription,
	createTeamInvite,
	createTournamentInvite,
	listTeamsForOrganizer,
	TournamentInvite,
	listTournamentInscriptions,
	listTournamentInvites,
	updateInscriptionStatus,
} from '../../services/inscriptionsApi';

type Stage = { id: string; name: string; order: number; format: 'league' | 'groups' | 'elimination' };
type Competition = { id: string; name: string; order: number; stages: Stage[] };
type Tournament = {
	id: string;
	name: string;
	venue?: string | null;
	organizer?: string | null;
	participantType?: string | null;
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
		default: // elimination
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

export const TournamentDetail: React.FC<{ id: string; onBack: () => void }> = ({ id, onBack }) => {
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [t, setT] = React.useState<Tournament | null>(null);
	const [inscriptions, setInscriptions] = React.useState<any[]>([]);
	const [invites, setInvites] = React.useState<TournamentInvite[]>([]);
	const [teamsOptions, setTeamsOptions] = React.useState<Array<{ id: number; name: string }>>([]);
	const [inscriptionLoading, setInscriptionLoading] = React.useState(false);
	const [inscriptionError, setInscriptionError] = React.useState<string | null>(null);
	const [manualTeamName, setManualTeamName] = React.useState('');
	const [manualTeamId, setManualTeamId] = React.useState<string>('');
	const [inviteLink, setInviteLink] = React.useState('');
	const [inviteLoading, setInviteLoading] = React.useState(false);
	const sessionUser = React.useMemo(() => {
		try {
			return JSON.parse(localStorage.getItem('liga360:user') || 'null');
		} catch {
			return null;
		}
	}, []);
	const isOrganizer = sessionUser?.type === 'organizer';

	React.useEffect(() => {
		async function load() {
			setLoading(true); setError(null);
			try {
				const query = `
					query($id:ID!){
						tournament(id:$id){
							id name venue organizer participantType
							competitions { id name order stages { id name order format } }
						}
					}
				`;
				const res = await fetch('http://localhost:4000/graphql', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ query, variables: { id } })
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

	React.useEffect(() => {
		if (!isOrganizer) return;
		async function loadInscriptions() {
			setInscriptionLoading(true);
			setInscriptionError(null);
			try {
				const [items, teams] = await Promise.all([
					listTournamentInscriptions(id),
					listTeamsForOrganizer(),
				]);
				setInscriptions(items);
				setTeamsOptions(teams);
				const loadedInvites = await listTournamentInvites(id);
				setInvites(loadedInvites);
				const general = loadedInvites.find((invite) => invite.invite_type === 'general' && invite.status === 'active');
				if (general) {
					setInviteLink(`${window.location.origin}/invite/${general.token}`);
				}
			} catch (e: any) {
				setInscriptionError(e?.message || 'No se pudieron cargar las inscripciones');
			} finally {
				setInscriptionLoading(false);
			}
		}
		loadInscriptions();
	}, [id, isOrganizer]);

	async function refreshInscriptions() {
		if (!isOrganizer) return;
		const [items, loadedInvites] = await Promise.all([
			listTournamentInscriptions(id),
			listTournamentInvites(id),
		]);
		setInscriptions(items);
		setInvites(loadedInvites);
		const general = loadedInvites.find((invite) => invite.invite_type === 'general' && invite.status === 'active');
		setInviteLink(general ? `${window.location.origin}/invite/${general.token}` : '');
	}

	async function handleAddManualTeam(e: React.FormEvent) {
		e.preventDefault();
		if (!manualTeamName.trim()) return;
		setInscriptionError(null);
		try {
			await createManualTeamInscription({
				tournamentId: id,
				name: manualTeamName.trim(),
				linkedTeamId: manualTeamId ? Number(manualTeamId) : null,
			});
			setManualTeamName('');
			setManualTeamId('');
			await refreshInscriptions();
		} catch (e: any) {
			setInscriptionError(e?.message || 'No se pudo agregar el equipo');
		}
	}

	async function handleGenerateInvite() {
		setInviteLoading(true);
		setInscriptionError(null);
		try {
			const invite = await createTournamentInvite(id);
			const link = `${window.location.origin}/invite/${invite.token}`;
			setInviteLink(link);
		} catch (e: any) {
			setInscriptionError(e?.message || 'No se pudo generar la invitacion');
		} finally {
			setInviteLoading(false);
		}
	}

	const teamInviteByInscriptionId = React.useMemo(() => {
		const map = new Map<number, TournamentInvite>();
		for (const invite of invites) {
			if (invite.invite_type !== 'team') continue;
			if (!invite.target_inscription_id) continue;
			if (!map.has(invite.target_inscription_id)) {
				map.set(invite.target_inscription_id, invite);
			}
		}
		return map;
	}, [invites]);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<button onClick={onBack} className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20 text-sm">← Volver</button>
			</div>

			{loading && <div className="text-sm opacity-80">Cargando…</div>}
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

					{isOrganizer && (
						<div className="rounded-xl border border-white/10 bg-white/10 p-5 space-y-4">
							<h3 className="text-lg font-semibold">Inscripciones básicas</h3>
							<div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
								<div className="flex flex-wrap items-center gap-2">
									<button
										type="button"
										onClick={handleGenerateInvite}
										className="rounded-xl bg-[#2E7D32] px-4 py-2 text-sm font-medium text-white hover:bg-[#256628]"
										disabled={inviteLoading}
									>
										{inviteLoading ? 'Generando…' : 'Generar enlace de invitación'}
									</button>
									{inviteLink && (
										<>
											<button
												type="button"
												className="rounded-xl border border-white/15 px-3 py-2 text-xs hover:bg-white/10"
												onClick={async () => {
													await navigator.clipboard.writeText(inviteLink);
												}}
											>
												Copiar link
											</button>
											<a
												href={`https://wa.me/?text=${encodeURIComponent(`Te invitamos al torneo ${t.name}. Link: ${inviteLink}`)}`}
												target="_blank"
												rel="noreferrer"
												className="rounded-xl border border-white/15 px-3 py-2 text-xs hover:bg-white/10"
											>
												Enviar por WhatsApp
											</a>
											<a
												href={`mailto:?subject=${encodeURIComponent(`Invitación al torneo ${t.name}`)}&body=${encodeURIComponent(`Te invitamos al torneo ${t.name}. Puedes asociar equipo o ver información general aquí: ${inviteLink}`)}`}
												className="rounded-xl border border-white/15 px-3 py-2 text-xs hover:bg-white/10"
											>
												Enviar por email
											</a>
										</>
									)}
								</div>
								{inviteLink && (
									<div className="text-xs opacity-80 break-all">
										Link activo: {inviteLink}
									</div>
								)}
							</div>
							<form onSubmit={handleAddManualTeam} className="grid grid-cols-1 md:grid-cols-3 gap-3">
								<input
									className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
									placeholder="Nombre del equipo (manual)"
									value={manualTeamName}
									onChange={(e) => setManualTeamName(e.target.value)}
									required
								/>
								<select
									className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
									value={manualTeamId}
									onChange={(e) => setManualTeamId(e.target.value)}
								>
									<option value="">Sin asociar a usuario/equipo</option>
									{teamsOptions.map((team) => (
										<option key={team.id} value={team.id}>{team.name}</option>
									))}
								</select>
								<button type="submit" className="rounded-xl bg-[#2E7D32] px-4 py-2 text-sm font-medium text-white hover:bg-[#256628]">
									Agregar equipo
								</button>
							</form>

							{inscriptionLoading && <div className="text-sm opacity-80">Cargando inscripciones…</div>}
							{inscriptionError && <div className="text-sm text-red-300">{inscriptionError}</div>}

							<div className="space-y-2">
								{inscriptions.map((inscription) => (
									<div key={inscription.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 md:flex-row md:items-center md:justify-between">
										<div className="text-sm">
											<div className="font-medium">{inscription.display_name}</div>
											<div className="opacity-75">
												Estado: {inscription.status}
												{inscription.linked_team_id ? ` • Equipo asociado #${inscription.linked_team_id}` : ' • Sin asociación'}
											</div>
											{inscription.source === 'manual' && (
												<div className="mt-1 opacity-75 text-xs">Cupo manual del torneo</div>
											)}
										</div>
										<div className="flex flex-wrap gap-2">
											{inscription.source === 'manual' && inscription.competitor_kind === 'team' && (
												<>
													<button
														type="button"
														onClick={async () => {
															await createTeamInvite(id, Number(inscription.id));
															await refreshInscriptions();
														}}
														className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
													>
														Invitar este equipo
													</button>
													{teamInviteByInscriptionId.get(Number(inscription.id)) && (
														<div className="text-xs opacity-80 rounded-lg border border-white/10 px-2 py-1">
															{(() => {
																const inv = teamInviteByInscriptionId.get(Number(inscription.id));
																const link = `${window.location.origin}/invite/${inv?.token}`;
																return (
																	<div className="flex flex-wrap items-center gap-2">
																		<span>
																			Invitación equipo: {inv?.status === 'consumed' ? 'consumida' : 'activa'}
																		</span>
																		<button
																			type="button"
																			onClick={async () => navigator.clipboard.writeText(link)}
																			className="rounded border border-white/10 px-2 py-0.5 hover:bg-white/10"
																		>
																			Copiar
																		</button>
																	</div>
																);
															})()}
														</div>
													)}
												</>
											)}
											{inscription.status === 'pending' && (
												<>
													<button
														type="button"
														onClick={async () => {
															await updateInscriptionStatus(inscription.id, 'approved');
															await refreshInscriptions();
														}}
														className="rounded-lg bg-[#2E7D32] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#256628]"
													>
														Aprobar
													</button>
													<button
														type="button"
														onClick={async () => {
															await updateInscriptionStatus(inscription.id, 'rejected');
															await refreshInscriptions();
														}}
														className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
													>
														Rechazar
													</button>
												</>
											)}
										</div>
									</div>
								))}
								{!inscriptionLoading && inscriptions.length === 0 && (
									<div className="text-sm opacity-75">No hay inscripciones para este torneo.</div>
								)}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
};


