import { API_ENDPOINTS } from '../config';
import { authHeaders } from '../http';
import type { MatchEvent } from './types';

export type TennisSetInput = {
  setNumber: number;
  homeGames: number | '';
  awayGames: number | '';
};

export type TennisSetDetail = {
  setNumber: number;
  homeGames: number;
  awayGames: number;
};

export type SaveTennisScorePayload = {
  tournament_id: string;
  competition_id?: string | null;
  status: string;
  sets: TennisSetInput[];
};

export type SaveTennisScoreResponse = {
  setsWon: { home: number; away: number };
  match: { id: string; homeScore: number | null; awayScore: number | null; status: string };
  events: MatchEvent[];
};

export const EMPTY_TENNIS_SET_ROWS: TennisSetInput[] = [
  { setNumber: 1, homeGames: '', awayGames: '' },
  { setNumber: 2, homeGames: '', awayGames: '' },
  { setNumber: 3, homeGames: '', awayGames: '' },
];

export function parseTennisSetEvents(events: MatchEvent[]): TennisSetDetail[] {
  return events
    .filter((e) => e.event_type === 'tennis_set')
    .map((e) => {
      const extra = (e.extra_json || {}) as Record<string, unknown>;
      return {
        setNumber: Number(extra.setNumber),
        homeGames: Number(extra.homeGames),
        awayGames: Number(extra.awayGames),
      };
    })
    .filter((s) => Number.isFinite(s.setNumber) && Number.isFinite(s.homeGames) && Number.isFinite(s.awayGames))
    .sort((a, b) => a.setNumber - b.setNumber);
}

export function tennisSetsToFormRows(events: MatchEvent[]): TennisSetInput[] {
  const details = parseTennisSetEvents(events);
  const rows = EMPTY_TENNIS_SET_ROWS.map((row) => ({ ...row }));
  for (const detail of details) {
    const idx = detail.setNumber - 1;
    if (idx >= 0 && idx < rows.length) {
      rows[idx] = {
        setNumber: detail.setNumber,
        homeGames: detail.homeGames,
        awayGames: detail.awayGames,
      };
    }
  }
  return rows;
}

export function formatTennisSetLine(set: TennisSetDetail): string {
  return `Set ${set.setNumber}: ${set.homeGames}–${set.awayGames}`;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((json as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`);
  }
  return json as T;
}

const base = () => API_ENDPOINTS.matchEvents;

export async function saveTennisScore(
  matchId: string,
  payload: SaveTennisScorePayload
): Promise<SaveTennisScoreResponse> {
  const res = await fetch(`${base()}/${encodeURIComponent(matchId)}/tennis-score`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<SaveTennisScoreResponse>(res);
}
