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
  /** Código de fixture (ej. L1-M2) */
  fixtureCode?: string;
  /** ISO 8601 string */
  scheduledAt?: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  /** Auditoría de carga de resultado (organizador) */
  resultRecordedAt?: string;
  resultRecordedBy?: string;
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

/** Edición de programación y resultado en el fixture (organizador). */
export type MatchFixtureEditingOptions = {
  /** Programar fecha/hora (también con torneo en borrador). */
  canSchedule: boolean;
  /** Cargar marcador (torneo publicado). */
  canEditResults: boolean;
  saveLocked?: boolean;
  onSaveSchedule: (matchId: string, scheduledAtIso: string | null) => Promise<void>;
  onSaveResult: (matchId: string, homeScore: number, awayScore: number) => Promise<void>;
};

export interface TournamentScheduleProps {
  type: TournamentFormat;
  data: TournamentScheduleData;
  /** Vista oscura (p. ej. detalle público) */
  theme?: 'light' | 'dark';
  className?: string;
  fixtureEditing?: MatchFixtureEditingOptions | null;
}
