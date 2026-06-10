import React from 'react';
import { TeamNameLink } from '../../components/team/TeamNameLink';
import type { GoalRecord } from '../../components/tournament-schedule/MatchCard';
import { bracketPublicTeamName } from '../../components/tournament-schedule/matchParticipantUtils';
import { isTwoLeggedSeries } from '../../components/tournament-schedule/eliminationSeriesUtils';
import {
	bracketMatchSlotHeight,
	bracketTreeContentHeight,
} from './bracketLayout';
import { buildConvergingBracketLayout, convergingBracketBaseH, slotKey } from './convergingBracketLayout';
import { buildConvergingConnectorPaths } from './convergingBracketConnectors';
import { isThirdPlaceMatchRow } from './eliminationInitHelpers';
import type { TournamentMatchRow, TournamentStage } from './types';

const BRACKET_CARD_W = 160;
const BRACKET_COL_GAP = 20;
const LABEL_H = 24;
const THIRD_PLACE_GAP = 8;
const THIRD_PLACE_LABEL_H = 16;

const CARD_FULL_H = bracketMatchSlotHeight(1);
const CARD_HALF_H = CARD_FULL_H / 2;
const BRACKET_BASE_H = convergingBracketBaseH(CARD_FULL_H);

function mapMatchStatus(raw: string | null | undefined): 'completed' | 'live' | 'scheduled' {
	const s = (raw || '').toLowerCase();
	if (s === 'finished' || s === 'completed') return 'completed';
	if (s === 'live' || s === 'in_progress' || s === 'playing') return 'live';
	return 'scheduled';
}

function bracketColLabel(roundNum: number, roundNums: number[], slotsInRound: number): string {
	const lastRound = roundNums[roundNums.length - 1];
	if (roundNum === lastRound && slotsInRound === 1) return 'Final';
	const ri = roundNums.indexOf(roundNum);
	const depthFromFinal = roundNums.length - 1 - ri;
	if (depthFromFinal === 1) return 'Semifinal';
	if (depthFromFinal === 2) return 'Cuartos';
	if (depthFromFinal === 3) return 'Octavos';
	return `Ronda ${roundNum}`;
}

function BracketTeamRow({ name, score, isWinner, isCompleted }: {
	name: string; score?: number | null; isWinner: boolean; isCompleted: boolean;
}) {
	const hasName = name.length > 0;
	return (
		<div className="flex items-center gap-1 px-2 py-1 min-h-[26px]">
			<span className={`flex-1 min-w-0 truncate text-xs ${hasName ? (isWinner ? 'font-semibold text-text-primary' : 'text-text-muted') : 'text-transparent select-none'}`}>
				{hasName ? <TeamNameLink teamName={name} className="max-w-full truncate align-bottom" /> : '\u00a0'}
			</span>
			<span className={`flex-none w-5 text-right tabular-nums text-xs ${hasName && isCompleted ? (isWinner ? 'font-bold text-text-primary' : 'text-text-muted') : 'text-transparent select-none'}`}>
				{hasName && isCompleted ? (score ?? 0) : ''}
			</span>
		</div>
	);
}

function BracketMatchSlot({ matches, isFinalCol, nameById }: {
	matches: TournamentMatchRow[];
	isFinalCol: boolean;
	nameById?: ReadonlyMap<string, string>;
}) {
	const borderCls = isFinalCol ? 'border-amber-400/60' : 'border-border-subtle';
	const bgCls = isFinalCol ? 'bg-amber-500/[0.10]' : 'bg-surface-2';
	const sorted = [...matches].sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0));

	if (isTwoLeggedSeries(sorted)) {
		const leg1 = sorted[0];
		const leg2 = sorted[1];
		const homeName = bracketPublicTeamName(leg1.homeAssignedInscription, nameById);
		const awayName = bracketPublicTeamName(leg1.awayAssignedInscription, nameById);
		let scoreHome = 0;
		let scoreAway = 0;
		let hasData = false;
		if (leg1.homeScore != null) { scoreHome += leg1.homeScore; hasData = true; }
		if (leg1.awayScore != null) { scoreAway += leg1.awayScore; hasData = true; }
		if (leg2?.homeScore != null) { scoreAway += leg2.homeScore; hasData = true; }
		if (leg2?.awayScore != null) { scoreHome += leg2.awayScore; hasData = true; }
		const isCompleted = sorted.every((m) => mapMatchStatus(m.status) === 'completed');
		const homeWins = isCompleted && hasData && scoreHome > scoreAway;
		const awayWins = isCompleted && hasData && scoreAway > scoreHome;
		return (
			<div className={`rounded-lg border overflow-hidden ${borderCls} ${bgCls}`}>
				<BracketTeamRow
					name={homeName}
					score={hasData ? scoreHome : null}
					isWinner={homeWins}
					isCompleted={isCompleted && hasData}
				/>
				<div className="border-t border-border-subtle/40" />
				<BracketTeamRow
					name={awayName}
					score={hasData ? scoreAway : null}
					isWinner={awayWins}
					isCompleted={isCompleted && hasData}
				/>
			</div>
		);
	}

	return (
		<div className={`rounded-lg border overflow-hidden ${borderCls} ${bgCls}`}>
			{sorted.map((m) => {
				const status = mapMatchStatus(m.status);
				const isCompleted = status === 'completed';
				const hs = m.homeScore ?? 0;
				const as_ = m.awayScore ?? 0;
				const homeWins = isCompleted && hs > as_;
				const awayWins = isCompleted && as_ > hs;
				const homeName = bracketPublicTeamName(m.homeAssignedInscription, nameById);
				const awayName = bracketPublicTeamName(m.awayAssignedInscription, nameById);
				return (
					<div key={m.id}>
						<BracketTeamRow name={homeName} score={m.homeScore} isWinner={homeWins} isCompleted={isCompleted} />
						<div className="border-t border-border-subtle/40" />
						<BracketTeamRow name={awayName} score={m.awayScore} isWinner={awayWins} isCompleted={isCompleted} />
					</div>
				);
			})}
		</div>
	);
}

export function ConvergingEliminationBracket({ stage, nameById }: {
	stage: TournamentStage;
	nameById?: ReadonlyMap<string, string>;
}) {
	const scrollRef = React.useRef<HTMLDivElement>(null);

	const allMatches = [...(stage.matches || [])].sort((a, b) => {
		const r = (a.round ?? 0) - (b.round ?? 0);
		if (r !== 0) return r;
		const si = (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
		if (si !== 0) return si;
		return (a.leg ?? 0) - (b.leg ?? 0);
	});

	const thirdPlaceMatches = allMatches.filter((m) => isThirdPlaceMatchRow(m));
	const treeMatches = allMatches.filter((m) => !isThirdPlaceMatchRow(m));

	const roundMap = new Map<number, Map<number, TournamentMatchRow[]>>();
	for (const m of treeMatches) {
		const r = m.round ?? 1;
		const s = m.slotIndex ?? 1;
		if (!roundMap.has(r)) roundMap.set(r, new Map());
		const sm = roundMap.get(r)!;
		const arr = sm.get(s) ?? [];
		arr.push(m);
		sm.set(s, arr);
	}
	const roundNums = [...roundMap.keys()].sort((a, b) => a - b);
	if (roundNums.length === 0 && thirdPlaceMatches.length === 0) return null;

	const M = Math.max(1, roundNums.length);
	const centerCol = M - 1;

	const { entries, feederGraph } = buildConvergingBracketLayout({
		roundMap,
		roundNums,
		baseH: BRACKET_BASE_H,
	});

	const entryBySlot = new Map(
		entries.map((e) => [slotKey(e.roundNum, e.slotIdx), e] as const),
	);
	const connectorPaths = buildConvergingConnectorPaths({
		entries,
		feederGraph,
		entryBySlot,
		labelH: LABEL_H,
		cardW: BRACKET_CARD_W,
		colGap: BRACKET_COL_GAP,
	});

	const colLabels = new Map<number, string>();
	roundNums.forEach((roundNum, ri) => {
		const slotMap = roundMap.get(roundNum)!;
		const label = bracketColLabel(roundNum, roundNums, slotMap.size);
		const isLast = ri === M - 1;
		if (isLast) {
			colLabels.set(centerCol, label);
		} else {
			colLabels.set(ri, label);
		}
	});

	const totalCols = 2 * M - 1;
	const totalW = totalCols * (BRACKET_CARD_W + BRACKET_COL_GAP) - BRACKET_COL_GAP;
	const treeHeight = bracketTreeContentHeight(
		entries.map((e) => ({
			centerY: e.centerY,
			legCount: isTwoLeggedSeries(e.matches) ? 1 : e.matches.length,
		})),
		LABEL_H,
		CARD_HALF_H,
	);
	const thirdPlaceHeight = thirdPlaceMatches.length > 0
		? THIRD_PLACE_LABEL_H + bracketMatchSlotHeight(thirdPlaceMatches.length)
		: 0;
	const containerHeight = treeHeight + (thirdPlaceHeight > 0 ? THIRD_PLACE_GAP + thirdPlaceHeight : 0);

	React.useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
	}, [stage.id, entries.length, containerHeight]);

	return (
		<div ref={scrollRef} className="overflow-x-auto pb-2">
			<div className="relative" style={{ width: totalW, height: containerHeight }}>
				{[...colLabels.entries()].map(([col, label]) => (
					<p
						key={col}
						className="absolute text-center text-[10px] font-medium text-text-muted"
						style={{ left: col * (BRACKET_CARD_W + BRACKET_COL_GAP), top: 0, width: BRACKET_CARD_W }}
					>
						{label}
					</p>
				))}
				{connectorPaths.length > 0 ? (
					<svg
						className="pointer-events-none absolute inset-0 z-0"
						width={totalW}
						height={containerHeight}
						aria-hidden
					>
						{connectorPaths.map((d, i) => (
							<path
								key={i}
								d={d}
								fill="none"
								stroke="currentColor"
								strokeWidth={1.5}
								strokeLinejoin="round"
								strokeLinecap="round"
								className="text-brand-green/35"
							/>
						))}
					</svg>
				) : null}
				{entries.map(({ roundNum, slotIdx, matches, col, centerY: center, isFinalCol }) => {
					const x = col * (BRACKET_CARD_W + BRACKET_COL_GAP);
					const top = LABEL_H + center - CARD_HALF_H;
					return (
						<div
							key={`${roundNum}-${slotIdx}`}
							className="absolute z-10"
							style={{ left: x, top: Math.max(LABEL_H, top), width: BRACKET_CARD_W }}
						>
							<BracketMatchSlot matches={matches} isFinalCol={isFinalCol} nameById={nameById} />
						</div>
					);
				})}
				{thirdPlaceMatches.length > 0 ? (
					<div
						className="absolute z-10"
						style={{
							left: centerCol * (BRACKET_CARD_W + BRACKET_COL_GAP),
							top: treeHeight + THIRD_PLACE_GAP,
							width: BRACKET_CARD_W,
						}}
					>
						<p className="mb-1 text-center text-[10px] font-medium text-text-muted">3er puesto</p>
						<BracketMatchSlot matches={thirdPlaceMatches} isFinalCol={false} nameById={nameById} />
					</div>
				) : null}
			</div>
		</div>
	);
}
