import React from 'react';
import type { GoalRecord } from '../../components/tournament-schedule/MatchCard';
import type { ClassificationZone } from '../../components/standings';
import { getTournamentDetailById } from '../../services/tournamentsApi';
import { listMatchEvents } from '../../services/matchEvents/matchEvents';
import type { TournamentEntity, TournamentMatchRow, TournamentStage, StandingsRow } from './types';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatScheduledAt(dt: string | null | undefined): string {
	if (!dt) return '';
	try {
		const d = new Date(dt);
		return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	} catch {
		return dt;
	}
}

function mapMatchStatus(raw: string | null | undefined): 'completed' | 'live' | 'scheduled' {
	const s = (raw || '').toLowerCase();
	if (s === 'finished' || s === 'completed') return 'completed';
	if (s === 'live' || s === 'in_progress' || s === 'playing') return 'live';
	return 'scheduled';
}

type RoundBlock = { key: string; round: number; leg: number; label: string; matches: TournamentMatchRow[] };

function groupMatchesByRound(
	matches: TournamentMatchRow[],
	labelFn: (round: number, leg: number) => string = (r, leg) => (leg > 1 ? `Fecha ${r} · vuelta` : `Fecha ${r}`),
): RoundBlock[] {
	const sorted = [...matches].sort((a, b) => {
		const r = (a.round ?? 0) - (b.round ?? 0);
		if (r !== 0) return r;
		const l = (a.leg ?? 0) - (b.leg ?? 0);
		if (l !== 0) return l;
		return (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
	});
	const map = new Map<string, TournamentMatchRow[]>();
	for (const m of sorted) {
		const key = `${m.round ?? 0}|${m.leg ?? 1}`;
		const arr = map.get(key) ?? [];
		arr.push(m);
		map.set(key, arr);
	}
	const result: RoundBlock[] = [];
	for (const [key, list] of map) {
		const [r, leg] = key.split('|').map(Number);
		result.push({ key, round: r, leg, label: labelFn(r, leg), matches: list });
	}
	return result.sort((a, b) => (a.round !== b.round ? a.round - b.round : a.leg - b.leg));
}

function zonesFromStage(stage: TournamentStage, allStages: TournamentStage[]): ClassificationZone[] {
	const outgoing = (stage.transitions || []).filter((tr) => tr.toStageId);
	if (outgoing.length === 0) return [];
	const totalRows =
		stage.format === 'groups'
			? Math.max(...(stage.groups || []).map((g) => (g.standings || []).length), 0)
			: (stage.standings || []).length;

	const zones: ClassificationZone[] = [];
	for (const tr of outgoing) {
		const destName = allStages.find((s) => s.id === tr.toStageId)?.name ?? tr.toStageId ?? '?';
		const kind = String(tr.selectionKind || 'top').toLowerCase();
		let fromPos = 0;
		let toPos = 0;
		if (kind === 'top' && tr.topN) {
			fromPos = 1;
			toPos = Number(tr.topN);
		} else if (kind === 'range' && tr.rangeFrom && tr.rangeTo) {
			fromPos = Number(tr.rangeFrom);
			toPos = Number(tr.rangeTo);
		} else if (kind === 'bottom' && tr.bottomN && totalRows > 0) {
			fromPos = totalRows - Number(tr.bottomN) + 1;
			toPos = totalRows;
		}
		if (fromPos > 0 && toPos >= fromPos) {
			zones.push({ fromPos, toPos, label: `→ ${destName}`, colorIndex: zones.length });
		}
	}
	zones.sort((a, b) => a.fromPos - b.fromPos);
	return zones.map((z, i) => ({ ...z, colorIndex: i }));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ZONE_STYLES = [
	{ border: 'border-l-emerald-500', bgEven: 'bg-emerald-500/[0.12]', bgOdd: 'bg-emerald-500/[0.22]', dot: 'bg-emerald-500' },
	{ border: 'border-l-sky-500',     bgEven: 'bg-sky-500/[0.12]',     bgOdd: 'bg-sky-500/[0.22]',     dot: 'bg-sky-500'     },
	{ border: 'border-l-amber-500',   bgEven: 'bg-amber-500/[0.12]',   bgOdd: 'bg-amber-500/[0.22]',   dot: 'bg-amber-500'   },
	{ border: 'border-l-orange-500',  bgEven: 'bg-orange-500/[0.12]',  bgOdd: 'bg-orange-500/[0.22]',  dot: 'bg-orange-500'  },
	{ border: 'border-l-red-500',     bgEven: 'bg-red-500/[0.12]',     bgOdd: 'bg-red-500/[0.22]',     dot: 'bg-red-500'     },
];

function zoneStyle(idx: number) {
	return ZONE_STYLES[Math.min(idx, ZONE_STYLES.length - 1)];
}

// Tasks 3.1–3.4: compact match row — flex layout so team names always truncate correctly
function CompactMatchRow({ match, goals }: { match: TournamentMatchRow; goals?: GoalRecord[] }) {
	const homeName = match.homeAssignedInscription?.displayName ?? 'Por definir';
	const awayName = match.awayAssignedInscription?.displayName ?? 'Por definir';
	const status = mapMatchStatus(match.status);
	const isCompleted = status === 'completed';
	const isLive = status === 'live';

	return (
		<div className="px-3 py-1.5">
			<div className="flex items-center gap-1 text-xs">
				<span className="flex-1 min-w-0 text-right truncate text-text-primary">{homeName}</span>
				<span className={`flex-none w-11 text-center font-bold tabular-nums ${isLive ? 'text-emerald-400' : isCompleted ? 'text-text-primary' : 'text-text-muted font-normal'}`}>
					{isCompleted || isLive ? `${match.homeScore ?? 0}–${match.awayScore ?? 0}` : 'vs'}
				</span>
				<span className="flex-1 min-w-0 text-left truncate text-text-primary">{awayName}</span>
			</div>
			{match.scheduledAt && !isCompleted && !isLive && (
				<p className="text-center text-[10px] text-text-muted mt-0.5">{formatScheduledAt(match.scheduledAt)}</p>
			)}
			{goals && goals.length > 0 && (
				<p className="text-center text-[10px] text-text-muted mt-0.5">
					{goals.map((g, i) => (
						<span key={i}>
							{g.minute ? `${g.display_name} ${g.minute}'` : g.display_name}
							{i < goals.length - 1 ? ' · ' : ''}
						</span>
					))}
				</p>
			)}
		</div>
	);
}

// Splits items into N balanced columns with at most maxPerCol items each
function splitBalanced<T>(items: T[], maxPerCol = 4): T[][] {
	if (items.length === 0) return [];
	const nCols = Math.max(1, Math.ceil(items.length / maxPerCol));
	const perCol = Math.ceil(items.length / nCols);
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += perCol) chunks.push(items.slice(i, i + perCol));
	return chunks;
}

// Match grid for league/elimination: auto-fill responsive columns
function MatchGrid({ matches, goalsByMatchId }: { matches: TournamentMatchRow[]; goalsByMatchId: Record<string, GoalRecord[]> }) {
	if (matches.length === 0) return null;
	return (
		<div className="rounded-xl border border-border-subtle bg-border-subtle overflow-hidden">
			<div
				className="grid gap-px"
				style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}
			>
				{matches.map((m) => (
					<div key={m.id} className="bg-surface-2">
						<CompactMatchRow match={m} goals={goalsByMatchId[m.id]} />
					</div>
				))}
			</div>
		</div>
	);
}

// Group block: header + matches in balanced sub-columns (max 4 per column)
function GroupMatchBlock({ name, matches, goalsByMatchId }: {
	name: string;
	matches: TournamentMatchRow[];
	goalsByMatchId: Record<string, GoalRecord[]>;
}) {
	if (matches.length === 0) return null;
	const chunks = splitBalanced(matches, 4);
	return (
		<div>
			<p className="text-xs text-text-muted mb-1 font-medium">{name}</p>
			<div className="rounded-xl border border-border-subtle overflow-hidden bg-surface-2">
				<div className="grid" style={{ gridTemplateColumns: `repeat(${chunks.length}, 1fr)` }}>
					{chunks.map((chunk, ci) => (
						<div
							key={ci}
							className={`divide-y divide-border-subtle${ci < chunks.length - 1 ? ' border-r border-dashed border-border-subtle' : ''}`}
						>
							{chunk.map((m) => (
								<CompactMatchRow key={m.id} match={m} goals={goalsByMatchId[m.id]} />
							))}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Elimination bracket — left + right converge to center
// ---------------------------------------------------------------------------

const BRACKET_BASE_H = 68;
const BRACKET_CARD_W = 176;
const BRACKET_COL_GAP = 12;

function BracketTeamRow({ name, score, isWinner, isCompleted }: {
	name: string; score?: number | null; isWinner: boolean; isCompleted: boolean;
}) {
	return (
		<div className="flex items-center gap-1 px-2 py-1">
			<span className={`flex-1 min-w-0 truncate text-xs ${isWinner ? 'font-semibold text-text-primary' : 'text-text-muted'}`}>
				{name}
			</span>
			<span className={`flex-none w-5 text-right tabular-nums text-xs ${isWinner ? 'font-bold text-text-primary' : 'text-text-muted'}`}>
				{isCompleted ? (score ?? 0) : ''}
			</span>
		</div>
	);
}

function BracketMatchSlot({ matches, goalsByMatchId, isAdvancement, isFinalCol }: {
	matches: TournamentMatchRow[];
	goalsByMatchId: Record<string, GoalRecord[]>;
	isAdvancement: boolean;
	isFinalCol: boolean;
}) {
	const borderCls = isFinalCol ? 'border-amber-400/60' : isAdvancement ? 'border-sky-400/50' : 'border-border-subtle';
	const bgCls    = isFinalCol ? 'bg-amber-500/[0.10]'  : isAdvancement ? 'bg-sky-500/[0.10]'  : 'bg-surface-2';
	return (
		<div className={`rounded-lg border overflow-hidden ${borderCls} ${bgCls}`}>
			{matches.map((m, mi) => {
				const status = mapMatchStatus(m.status);
				const isCompleted = status === 'completed';
				const hs = m.homeScore ?? 0, as_ = m.awayScore ?? 0;
				const homeWins = isCompleted && hs > as_;
				const awayWins = isCompleted && as_ > hs;
				const homeName = m.homeAssignedInscription?.displayName ?? 'Por definir';
				const awayName = m.awayAssignedInscription?.displayName ?? 'Por definir';
				return (
					<div key={m.id}>
						{mi > 0 && (
							<p className="text-[9px] text-text-muted px-2 py-0.5 bg-surface-1 border-t border-border-subtle">
								Vuelta
							</p>
						)}
						<BracketTeamRow name={homeName} score={m.homeScore} isWinner={homeWins} isCompleted={isCompleted} />
						<div className="border-t border-border-subtle/40" />
						<BracketTeamRow name={awayName} score={m.awayScore} isWinner={awayWins} isCompleted={isCompleted} />
					</div>
				);
			})}
		</div>
	);
}

function EliminationBracket({ stage, goalsByMatchId }: {
	stage: TournamentStage;
	goalsByMatchId: Record<string, GoalRecord[]>;
}) {
	const allMatches = [...(stage.matches || [])].sort((a, b) => {
		const r = (a.round ?? 0) - (b.round ?? 0);
		if (r !== 0) return r;
		const si = (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
		if (si !== 0) return si;
		return (a.leg ?? 0) - (b.leg ?? 0);
	});

	// roundNum → slotIndex → matches[]
	const roundMap = new Map<number, Map<number, TournamentMatchRow[]>>();
	for (const m of allMatches) {
		const r = m.round ?? 1, s = m.slotIndex ?? 1;
		if (!roundMap.has(r)) roundMap.set(r, new Map());
		const sm = roundMap.get(r)!;
		const arr = sm.get(s) ?? [];
		arr.push(m);
		sm.set(s, arr);
	}
	const roundNums = [...roundMap.keys()].sort((a, b) => a - b);
	if (roundNums.length === 0) return null;

	const M = roundNums.length;
	const firstRoundMaxSlot = Math.max(...roundMap.get(roundNums[0])!.keys());
	const totalH = firstRoundMaxSlot * BRACKET_BASE_H;

	// centerY: BASE_H * (2s-1) * 2^(ri-1) where ri is 1-indexed position in roundNums
	function cy(roundNum: number, slotIdx: number): number {
		const ri = roundNums.indexOf(roundNum) + 1;
		return BRACKET_BASE_H * (2 * slotIdx - 1) * Math.pow(2, ri - 2);
	}

	// Column assignment:
	//   last round → center column (M-1)
	//   left half (slot <= maxSlot/2)  → col = ri (0-indexed)
	//   right half (slot > maxSlot/2)  → col = 2*(M-1) - ri  (mirrored)
	interface Entry { roundNum: number; slotIdx: number; matches: TournamentMatchRow[]; col: number; centerY: number; isFinalCol: boolean; isAdvancement: boolean }
	const entries: Entry[] = [];

	roundNums.forEach((roundNum, ri) => {
		const slotMap = roundMap.get(roundNum)!;
		const maxSlot = Math.max(...slotMap.keys());
		const isLast = ri === M - 1;
		slotMap.forEach((matches, slotIdx) => {
			const col = isLast ? M - 1 : slotIdx <= maxSlot / 2 ? ri : 2 * (M - 1) - ri;
			entries.push({
				roundNum, slotIdx, matches, col,
				centerY: cy(roundNum, slotIdx),
				isFinalCol: isLast,
				isAdvancement: matches.some((m) => m.winnerAdvancementTransitionId),
			});
		});
	});

	// Labels for left-side columns + center only
	const colLabels = new Map<number, string>();
	roundNums.forEach((roundNum, ri) => {
		const isLast = ri === M - 1;
		const col = isLast ? M - 1 : ri;
		if (!colLabels.has(col)) {
			const slotMap = roundMap.get(roundNum)!;
			colLabels.set(col, isLast && slotMap.size === 1 ? 'Final' : `Ronda ${roundNum}`);
		}
	});

	const CARD_H = 52;
	const LABEL_H = 24;
	const totalCols = 2 * M - 1;
	const totalW = totalCols * (BRACKET_CARD_W + BRACKET_COL_GAP) - BRACKET_COL_GAP;

	return (
		<div className="overflow-x-auto pb-2">
			<div className="relative" style={{ width: totalW, height: totalH + LABEL_H }}>
				{[...colLabels.entries()].map(([col, label]) => (
					<p key={col} className="absolute text-[10px] text-text-muted font-medium text-center"
						style={{ left: col * (BRACKET_CARD_W + BRACKET_COL_GAP), top: 0, width: BRACKET_CARD_W }}>
						{label}
					</p>
				))}
				{entries.map(({ roundNum, slotIdx, matches, col, centerY: center, isFinalCol, isAdvancement }) => {
					const x = col * (BRACKET_CARD_W + BRACKET_COL_GAP);
					const top = LABEL_H + center - CARD_H / 2;
					return (
						<div key={`${roundNum}-${slotIdx}`} className="absolute"
							style={{ left: x, top: Math.max(LABEL_H, top), width: BRACKET_CARD_W }}>
							<BracketMatchSlot
								matches={matches}
								goalsByMatchId={goalsByMatchId}
								isAdvancement={isAdvancement}
								isFinalCol={isFinalCol}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// Tasks 4.1–4.3: compact standings table
function CompactStandingsTable({ rows, zones = [] }: { rows: StandingsRow[]; zones?: ClassificationZone[] }) {
	if (rows.length === 0) return null;

	function rowZone(pos: number): ClassificationZone | undefined {
		return zones.find((z) => pos >= z.fromPos && pos <= z.toPos);
	}

	const legendZones = zones.filter((z, i, arr) => arr.findIndex((x) => x.label === z.label) === i);

	return (
		<div>
			<div className="rounded-xl border border-border-subtle bg-surface-1">
				<table className="w-full table-fixed text-xs text-text-primary">
					<colgroup>
						<col className="w-6" />
						<col />{/* Equipo — toma el ancho restante */}
						<col className="w-7" />
						<col className="w-7" />
						<col className="w-7" />
						<col className="w-7" />
						<col className="w-7" />
						<col className="w-7" />
						<col className="w-7" />
						<col className="w-8" />
					</colgroup>
					<thead>
						<tr className="text-text-muted border-b border-border-subtle">
							<th className="px-2 py-1 text-left font-medium">#</th>
							<th className="px-2 py-1 text-left font-medium">Equipo</th>
							<th className="px-2 py-1 text-center font-medium">PJ</th>
							<th className="px-2 py-1 text-center font-medium">PG</th>
							<th className="px-2 py-1 text-center font-medium">PE</th>
							<th className="px-2 py-1 text-center font-medium">PP</th>
							<th className="px-2 py-1 text-center font-medium">GF</th>
							<th className="px-2 py-1 text-center font-medium">GC</th>
							<th className="px-2 py-1 text-center font-medium">DG</th>
							<th className="px-2 py-1 text-center font-semibold">Pts</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => {
							const zone = rowZone(row.position);
							const s = zone ? zoneStyle(zone.colorIndex) : null;
							// Alternate tones within the same zone for row scannability
							const isOddInZone = zone ? (row.position - zone.fromPos) % 2 !== 0 : false;
							const bg = s ? (isOddInZone ? s.bgOdd : s.bgEven) : '';
							return (
								<tr
									key={row.inscriptionId}
									className={[
										'border-b last:border-b-0 border-border-subtle',
										s ? `border-l-2 ${s.border} ${bg}` : 'border-l-2 border-l-transparent',
									].join(' ')}
								>
									<td className="px-2 py-1 text-text-muted">{row.position}</td>
									<td className="px-2 py-1 font-medium truncate">{row.displayName}</td>
									<td className="px-2 py-1 text-center">{row.played}</td>
									<td className="px-2 py-1 text-center">{row.won}</td>
									<td className="px-2 py-1 text-center">{row.drawn}</td>
									<td className="px-2 py-1 text-center">{row.lost}</td>
									<td className="px-2 py-1 text-center">{row.goalsFor}</td>
									<td className="px-2 py-1 text-center">{row.goalsAgainst}</td>
									<td className="px-2 py-1 text-center">{row.goalDifference}</td>
									<td className="px-2 py-1 text-center font-bold">{row.points}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			{legendZones.length > 0 && (
				<div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
					{legendZones.map((z) => {
						const s = zoneStyle(z.colorIndex);
						return (
							<span key={z.label} className="flex items-center gap-1 text-[10px] text-text-muted">
								<span className={`inline-block h-2 w-2 rounded-sm ${s.dot}`} />
								{z.label}
							</span>
						);
					})}
				</div>
			)}
		</div>
	);
}

function stageFirstRoundKey(stage: { format: string; matches?: TournamentMatchRow[]; groups?: { matches?: TournamentMatchRow[] }[] }): string {
	if (stage.format === 'league' || stage.format === 'elimination') {
		return firstGroupRoundKey([{ matches: stage.matches }]);
	}
	if (stage.format === 'groups') {
		return firstGroupRoundKey(stage.groups || []);
	}
	return '';
}

function firstGroupRoundKey(groups: { matches?: TournamentMatchRow[] }[]): string {
	let minRound = Infinity, minLeg = Infinity;
	for (const g of groups) {
		for (const m of g.matches || []) {
			const r = m.round ?? 0, l = m.leg ?? 1;
			if (r < minRound || (r === minRound && l < minLeg)) { minRound = r; minLeg = l; }
		}
	}
	return minRound === Infinity ? '' : `${minRound}|${minLeg}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const TournamentDetail: React.FC<{ id: string; onBack: () => void; onConfig?: () => void }> = ({ id, onBack, onConfig }) => {
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [t, setT] = React.useState<TournamentEntity | null>(null);
	const [goalsByMatchId, setGoalsByMatchId] = React.useState<Record<string, GoalRecord[]>>({});

	const [competitionId, setCompetitionId] = React.useState('');
	const [stageId, setStageId] = React.useState('');
	// For groups-format stages: navigate by round, show all groups as columns
	const [groupRoundKey, setGroupRoundKey] = React.useState('');

	React.useEffect(() => {
		async function load() {
			setLoading(true);
			setError(null);
			try {
				const tournament = await getTournamentDetailById(id);
				setT((tournament || null) as TournamentEntity | null);

				if (tournament) {
					// Task 1.1: init to first competition/stage by order
					const sortedComps = [...(tournament.competitions || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
					const firstComp = sortedComps[0];
					if (firstComp) {
						setCompetitionId(firstComp.id);
						const firstStage = [...firstComp.stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
						if (firstStage) {
							setStageId(firstStage.id);
							setGroupRoundKey(stageFirstRoundKey(firstStage));
						}
					}

					// Load goals for completed matches
					const completedMatches: TournamentMatchRow[] = [];
					for (const c of tournament.competitions || []) {
						for (const s of c.stages || []) {
							for (const m of s.matches || []) {
								if (String(m.status || '').toLowerCase() === 'completed' || String(m.status || '').toLowerCase() === 'finished') {
									completedMatches.push(m);
								}
							}
							for (const g of s.groups || []) {
								for (const m of g.matches || []) {
									if (String(m.status || '').toLowerCase() === 'completed' || String(m.status || '').toLowerCase() === 'finished') {
										completedMatches.push(m);
									}
								}
							}
						}
					}
					if (completedMatches.length > 0) {
						const results = await Promise.allSettled(
							completedMatches.map(async (m) => {
								const events = await listMatchEvents(m.id);
								return { matchId: m.id, goals: events.filter((e) => e.event_type === 'goal') };
							}),
						);
						const map: Record<string, GoalRecord[]> = {};
						for (const r of results) {
							if (r.status === 'fulfilled' && r.value.goals.length > 0) {
								map[r.value.matchId] = r.value.goals.map((e) => ({
									display_name: e.display_name,
									minute: e.minute,
								}));
							}
						}
						setGoalsByMatchId(map);
					}
				}
			} catch (e: any) {
				setError(e?.message || 'Error al cargar torneo');
			} finally {
				setLoading(false);
			}
		}
		load();
	}, [id]);

	function handleCompetitionChange(cid: string) {
		setCompetitionId(cid);
		const comp = t?.competitions.find((c) => c.id === cid);
		if (!comp) return;
		const firstStage = [...comp.stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
		if (firstStage) {
			setStageId(firstStage.id);
			setGroupRoundKey(stageFirstRoundKey(firstStage));
		} else {
			setStageId('');
			setGroupRoundKey('');
		}
	}

	function handleStageChange(sid: string) {
		setStageId(sid);
		const comp = t?.competitions.find((c) => c.id === competitionId);
		const s = comp?.stages.find((st) => st.id === sid);
		setGroupRoundKey(s ? stageFirstRoundKey(s) : '');
	}

	if (!t && !loading && !error) return null;

	const sortedComps = t ? [...t.competitions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
	const competition = sortedComps.find((c) => c.id === competitionId) ?? sortedComps[0] ?? null;
	const selectableStages = competition
		? [...competition.stages]
				.filter((s) => s.format === 'league' || s.format === 'elimination' || s.format === 'groups')
				.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
		: [];
	const stage = selectableStages.find((s) => s.id === stageId) ?? selectableStages[0] ?? null;
	const allStages = sortedComps.flatMap((c) => c.stages);

	const sortedGroups = stage?.format === 'groups'
		? [...(stage.groups || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
		: [];

	// Rounds for groups format (across all groups)
	const groupRounds: { key: string; label: string }[] = React.useMemo(() => {
		if (!stage || stage.format !== 'groups') return [];
		const map = new Map<string, { round: number; leg: number }>();
		for (const g of stage.groups || []) {
			for (const m of g.matches || []) {
				const r = m.round ?? 0, l = m.leg ?? 1;
				const key = `${r}|${l}`;
				if (!map.has(key)) map.set(key, { round: r, leg: l });
			}
		}
		return [...map.entries()]
			.sort(([, a], [, b]) => a.round !== b.round ? a.round - b.round : a.leg - b.leg)
			.map(([key, { round, leg }]) => ({ key, label: leg > 1 ? `Fecha ${round} · vuelta` : `Fecha ${round}` }));
	}, [stage]);

	// Rounds for league format
	const leagueRounds: { key: string; label: string }[] = React.useMemo(() => {
		if (!stage || stage.format !== 'league') return [];
		return groupMatchesByRound(stage.matches || []).map((b) => ({ key: b.key, label: b.label }));
	}, [stage]);

	const zones = stage ? zonesFromStage(stage, allStages) : [];

	// Task 5.5: has any matches in active stage
	const hasMatches = stage
		? stage.format === 'groups'
			? (stage.groups || []).some((g) => (g.matches || []).length > 0)
			: (stage.matches || []).length > 0
		: false;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<button onClick={onBack} className="px-3 py-1.5 rounded-md border border-border-subtle hover:border-border-strong text-sm text-text-primary transition-colors">
					← Volver
				</button>
				{onConfig && (
					<button
						onClick={onConfig}
						title="Configurar torneo"
						className="flex items-center justify-center w-8 h-8 rounded-md border border-border-subtle hover:border-border-strong hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors"
					>
						<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<circle cx="12" cy="12" r="3" />
							<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
						</svg>
					</button>
				)}
			</div>

			{loading && <div className="text-sm text-text-muted">Cargando...</div>}
			{error && <div className="text-sm text-red-300">{error}</div>}

			{!loading && !error && t && (
				<div className="space-y-4">
					{/* Tournament header */}
					<div className="rounded-xl border border-border-subtle bg-surface-1 p-5">
						<div className="flex items-center gap-2 mb-2">
							<span className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border-subtle bg-surface-2">
								<TournamentIcon />
							</span>
							<h2 className="text-2xl font-semibold text-text-primary">{t.name}</h2>
						</div>
						<div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-text-muted">
							<div><span className="opacity-70">Ubicación:</span> {t.venue || 'N/D'}</div>
							<div><span className="opacity-70">Organizador:</span> {t.organizer || 'N/D'}</div>
							<div><span className="opacity-70">Participantes:</span> {t.participantType || 'N/D'}</div>
						</div>
					</div>

					{sortedComps.length > 0 && (
						<div className="rounded-xl border border-border-subtle bg-surface-1 p-4 space-y-3">
							{/* Task 1.2: Competition pills — same style as FixturePlanningPanel, only if >1 */}
							{sortedComps.length > 1 && (
								<div className="inline-flex flex-wrap rounded-xl bg-surface-0 p-1">
									{sortedComps.map((c) => (
										<button
											key={c.id}
											type="button"
											onClick={() => handleCompetitionChange(c.id)}
											className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
												competitionId === c.id
													? 'bg-surface-3 text-text-primary shadow-sm'
													: 'text-text-muted hover:text-text-primary'
											}`}
										>
											{c.name}
										</button>
									))}
								</div>
							)}

							{/* Task 1.3 + 1.4: Stage pills — same style as FixturePlanningPanel */}
							{selectableStages.length > 0 && (
								<div className="flex flex-wrap gap-1.5">
									{selectableStages.map((s) => (
										<button
											key={s.id}
											type="button"
											onClick={() => handleStageChange(s.id)}
											className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
												stageId === s.id || (!stageId && s.id === selectableStages[0]?.id)
													? 'border-accent-primary bg-accent-soft text-success-base'
													: 'border-border-subtle bg-surface-2 text-text-muted hover:border-border-strong hover:text-text-primary'
											}`}
										>
											{s.order}. {s.name}
											{/* Task 1.4: badge punto verde si stageStatus === 'active' */}
											{s.stageStatus === 'active' && (
												<span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
											)}
										</button>
									))}
								</div>
							)}

							{/* Round pills — league and groups both navigate by fecha */}
							{(() => {
								const rounds = stage?.format === 'league' ? leagueRounds : stage?.format === 'groups' ? groupRounds : [];
								if (rounds.length === 0) return null;
								const activeKey = groupRoundKey || rounds[0]?.key;
								return (
									<div className="flex flex-wrap gap-1.5">
										{rounds.map((r) => (
											<button
												key={r.key}
												type="button"
												onClick={() => setGroupRoundKey(r.key)}
												className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
													activeKey === r.key
														? 'border-accent-primary bg-accent-soft text-success-base'
														: 'border-border-subtle bg-surface-2 text-text-muted hover:border-border-strong hover:text-text-primary'
												}`}
											>
												{r.label}
											</button>
										))}
									</div>
								);
							})()}

							{/* Stage content */}
							{stage && !hasMatches && (
								<p className="text-sm text-text-muted py-2">Sin partidos generados aún</p>
							)}

							{/* League — misma lógica que grupos: fecha seleccionada, partidos en columnas equilibradas */}
							{stage?.format === 'league' && hasMatches && (() => {
								const activeKey = groupRoundKey || leagueRounds[0]?.key || '';
								const activeMatches = groupMatchesByRound(stage.matches || []).find((b) => b.key === activeKey)?.matches ?? [];
								const chunks = splitBalanced(activeMatches, 4);
								const nCols = Math.max(1, chunks.length);
								return (
									<div className="space-y-3">
										{chunks.length > 0 && (
											<div className="rounded-xl border border-border-subtle overflow-hidden bg-surface-2">
												<div className="grid" style={{ gridTemplateColumns: `repeat(${nCols}, minmax(0, 1fr))` }}>
													{chunks.map((chunk, ci) => (
														<div key={ci} className={`divide-y divide-border-subtle${ci < chunks.length - 1 ? ' border-r border-dashed border-border-subtle' : ''}`}>
															{chunk.map((m) => (
																<CompactMatchRow key={m.id} match={m} goals={goalsByMatchId[m.id]} />
															))}
														</div>
													))}
												</div>
											</div>
										)}
										{(stage.standings ?? []).length > 0 && (
											<div className="pt-1 space-y-1.5">
												<p className="text-xs text-text-muted font-medium">Tabla de posiciones</p>
												<CompactStandingsTable rows={stage.standings ?? []} zones={zones} />
											</div>
										)}
									</div>
								);
							})()}

							{/* Elimination — bracket visual */}
							{stage?.format === 'elimination' && hasMatches && (
								<EliminationBracket stage={stage} goalsByMatchId={goalsByMatchId} />
							)}

							{/* Groups: grupos en columnas, cada uno con sub-columnas equilibradas de partidos */}
							{stage?.format === 'groups' && hasMatches && (() => {
								const activeKey = groupRoundKey || groupRounds[0]?.key || '';
								const activeGroups = sortedGroups.map((g) => ({
									g,
									matches: (g.matches || []).filter(
										(m) => `${m.round ?? 0}|${m.leg ?? 1}` === activeKey,
									),
								})).filter(({ matches }) => matches.length > 0);
								const groupCols = Math.max(1, activeGroups.length);
								const standingGroups = sortedGroups.filter((g) => (g.standings ?? []).length > 0);
								const standingCols = Math.max(1, standingGroups.length);
								return (
									<div className="space-y-3">
										<div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${groupCols}, minmax(0, 1fr))` }}>
											{activeGroups.map(({ g, matches }) => (
												<GroupMatchBlock key={g.id} name={g.name} matches={matches} goalsByMatchId={goalsByMatchId} />
											))}
										</div>
										{standingGroups.length > 0 && (
											<div className="pt-1 space-y-2">
												<p className="text-xs text-text-muted font-medium">Tabla de posiciones</p>
												<div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${standingCols}, minmax(0, 1fr))` }}>
													{standingGroups.map((g) => (
														<div key={`s-${g.id}`} className="space-y-1">
															<p className="text-[11px] text-text-muted font-medium">{g.name}</p>
															<CompactStandingsTable rows={g.standings ?? []} zones={zones} />
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								);
							})()}
						</div>
					)}
				</div>
			)}
		</div>
	);
};
