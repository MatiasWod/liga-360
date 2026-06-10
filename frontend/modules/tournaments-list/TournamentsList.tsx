import React from 'react';
import { deleteTournamentById, listTournamentsGraphql } from '../../services/tournamentsApi';
import type { TournamentEntity } from './types';
import { TournamentFlipCard } from './TournamentFlipCard';

export const TournamentsList: React.FC<{
	onOpen?: (id: string, name?: string) => void;
	onInscribe?: (tournamentId: string) => Promise<void>;
	onConfig?: (id: string, name: string) => void;
	organizerFilter?: string;
	inscriptionModeFilter?: 'public' | 'invitation';
	participantTypeFilter?: 'teams' | 'individuals';
	searchTerm?: string;
	idsFilter?: string[];
	excludeIdsFilter?: string[];
	hideFinished?: boolean;
	/** Si true, solo torneos con status finished/closed (pestaña Finalizados). */
	onlyFinished?: boolean;
}> = ({ onOpen, onInscribe, onConfig, organizerFilter, inscriptionModeFilter, participantTypeFilter, searchTerm, idsFilter, excludeIdsFilter, hideFinished, onlyFinished }) => {
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [items, setItems] = React.useState<TournamentEntity[]>([]);
	const currentOrganizer = (organizerFilter || '').trim().toLowerCase();

	function normalizeParticipantType(value: string | null | undefined): 'teams' | 'individuals' {
		const raw = String(value || '').trim().toLowerCase();
		if (raw === 'team' || raw === 'teams') return 'teams';
		if (raw === 'participant' || raw === 'participants' || raw === 'individual' || raw === 'individuals') return 'individuals';
		return 'teams';
	}

	function matchesSearchTerm(tournament: TournamentEntity, term: string): boolean {
		const query = term.trim().toLowerCase();
		if (!query) return true;

		const normalizedParticipantType = normalizeParticipantType(tournament.participantType);
		const participantTypeLabel = normalizedParticipantType === 'teams' ? 'equipos teams team' : 'participantes participant participants individual individuales';
		const searchable = [
			tournament.name,
			tournament.organizer,
			tournament.venue,
			tournament.participantType,
			participantTypeLabel,
			...(tournament.competitions || []).map((competition) => competition.name),
			...(tournament.competitions || []).flatMap((competition) => (competition.stages || []).map((stage) => stage.name)),
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();

		return searchable.includes(query);
	}

	async function load() {
		setLoading(true); setError(null);
		try {
			const all = await listTournamentsGraphql() as TournamentEntity[];
			let filtered = all;
			if (onlyFinished) {
				filtered = filtered.filter((t) => t.status === 'finished' || t.status === 'closed');
			} else if (hideFinished) {
				filtered = filtered.filter((t) => t.status !== 'finished' && t.status !== 'closed');
			}
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
			if (searchTerm?.trim()) {
				filtered = filtered.filter((t) => matchesSearchTerm(t, searchTerm));
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

	async function handleDelete(id: string, name: string) {
		try {
			await deleteTournamentById(id);
			await load();
		} catch (err: any) {
			setError(err?.message || 'No se pudo eliminar torneo');
		}
	}

	React.useEffect(() => {
		load();
	}, [organizerFilter, inscriptionModeFilter, participantTypeFilter, searchTerm, idsFilter, excludeIdsFilter, hideFinished, onlyFinished]);

	if (loading) return <div className="text-sm opacity-80">Cargando torneos…</div>;
	if (error) return <div className="text-sm text-red-300">{error}</div>;

	if (items.length === 0) {
		const emptyMsg = onlyFinished
			? 'No hay torneos finalizados publicados.'
			: hideFinished
				? 'No hay torneos activos publicados.'
				: 'Aún no hay torneos creados.';
		return <div className="text-sm opacity-80">{emptyMsg}</div>;
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{items.map((t) => (
				<TournamentFlipCard
					key={t.id}
					tournament={t}
					currentOrganizer={currentOrganizer || undefined}
					onOpen={onOpen}
					onDelete={handleDelete}
					onInscribe={onInscribe}
					onConfig={onConfig}
				/>
			))}
		</div>
	);
};
