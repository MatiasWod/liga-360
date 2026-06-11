export type NavItemId = 'inicio' | 'agenda' | 'equipos' | 'participantes' | 'torneos' | 'perfil';
export type UserRole = 'organizer' | 'team' | 'participant';

export interface NavItem {
  id: NavItemId;
  label: string;
}

export type ParticipantStatus = 'claimed' | 'unclaimed';

export interface AppUser {
  id: string;
  fullName: string;
  username?: string;
  type?: UserRole;
  avatarUrl?: string | null;
}

export interface TeamInfo {
  id: string;
  name: string;
  badgeUrl?: string | null;
  secretCode?: string;
  inviteCode?: string | null;
  isOwner: boolean;
}

export interface TeamParticipant {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  dni?: string;
  avatarUrl?: string;
  status: ParticipantStatus;
}

export interface LinkedTeam {
  id: string;
  name: string;
  roleLabel: string;
  badgeUrl?: string;
}

