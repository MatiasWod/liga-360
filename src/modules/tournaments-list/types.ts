export type TournamentStageFormat = 'league' | 'groups' | 'elimination' | 'composed';

export type AssignedInscription = {
  inscriptionId: string;
  displayName: string;
};

export type TournamentMatchRow = {
  id: string;
  round?: number | null;
  leg?: number | null;
  slotIndex?: number | null;
  fixtureCode?: string | null;
  groupId?: string | null;
  scheduledAt?: string | null;
  leagueHomeSeed?: number | null;
  leagueAwaySeed?: number | null;
  homeAssignedInscription?: AssignedInscription | null;
  awayAssignedInscription?: AssignedInscription | null;
};

export type TournamentGroupBlock = {
  id: string;
  name: string;
  order: number;
  capacity?: number | null;
  assignedInscriptions?: AssignedInscription[];
  matches?: TournamentMatchRow[];
};

export type TournamentTransition = {
  id: string;
  label?: string | null;
  toStageId?: string | null;
  selectionKind?: string | null;
  topN?: number | null;
  rangeFrom?: number | null;
  rangeTo?: number | null;
  bottomN?: number | null;
  toExternalTournamentId?: string | null;
  toExternalStageId?: string | null;
  toExternalTournamentName?: string | null;
};

export type TournamentStage = {
  id: string;
  name: string;
  order: number;
  format: TournamentStageFormat;
  isInitial?: boolean;
  configJson?: string | null;
  childrenJson?: string | null;
  transitions?: TournamentTransition[];
  assignedInscriptions?: AssignedInscription[];
  matches?: TournamentMatchRow[];
  groups?: TournamentGroupBlock[];
};

export type TournamentCompetition = {
  id: string;
  name: string;
  order: number;
  stages: TournamentStage[];
};

export type TournamentEntity = {
  id: string;
  name: string;
  venue?: string | null;
  organizer?: string | null;
  participantType?: string | null;
  inscriptionMode?: 'public' | 'invitation' | null;
  status?: string | null;
  competitions: TournamentCompetition[];
};
