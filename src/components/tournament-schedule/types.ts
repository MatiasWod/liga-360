export type TournamentFormat = 'league' | 'groups' | 'knockout';

export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'postponed';

export interface TeamRef {
  id: string;
  name: string;
  shortName?: string;
  badgeUrl?: string;
}

export interface MatchRecord {
  id: string;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  /** ISO 8601 string */
  scheduledAt?: string;
  venue?: string;
  referee?: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  /** Pata de la serie (1 = ida, 2 = vuelta). Presente solo en eliminación doble. */
  leg?: number;
  /** Slot de la llave (para agrupar las dos patas de una misma serie). */
  slotIndex?: number;
  /** Código P{n}R{m} en eliminatorias (p. ej. P1R1). */
  matchCode?: string;
  /** Subtítulo legible: Partido n · Ronda m. */
  matchSubtitle?: string;
}

export interface ScheduleRound {
  id: string;
  label: string;
  matches: MatchRecord[];
}

export interface LeagueScheduleData {
  rounds: ScheduleRound[];
}

export interface GroupBlock {
  id: string;
  name: string;
  rounds: ScheduleRound[];
}

export interface GroupsScheduleData {
  groups: GroupBlock[];
}

export interface KnockoutScheduleData {
  rounds: ScheduleRound[];
}

export type TournamentScheduleData = LeagueScheduleData | GroupsScheduleData | KnockoutScheduleData;

export interface TournamentScheduleProps {
  type: TournamentFormat;
  data: TournamentScheduleData;
  /** Vista oscura (p. ej. detalle público) */
  theme?: 'light' | 'dark';
  className?: string;
}
