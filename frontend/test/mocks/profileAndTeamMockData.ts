import type { AppUser, LinkedTeam, TeamInfo, TeamParticipant } from '../../types/domain';

export const mockCurrentUser: AppUser = {
  id: 'u-1',
  fullName: 'Bruno Baumgart',
  avatarUrl: '',
};

export const mockActiveTeam: TeamInfo = {
  id: 't-1',
  name: 'Java FC',
  badgeUrl: '',
  secretCode: 'JAVA-360-91',
  isOwner: true,
};

export const mockTeamParticipants: TeamParticipant[] = [
  {
    id: 'p-1',
    firstName: 'Juan',
    lastName: 'Perez',
    nickname: 'JP',
    dni: '12345678',
    avatarUrl: '',
    status: 'claimed',
  },
  {
    id: 'p-2',
    firstName: 'Martin',
    lastName: 'Lopez',
    nickname: 'Titi',
    dni: '33444555',
    avatarUrl: '',
    status: 'unclaimed',
  },
  {
    id: 'p-3',
    firstName: 'Nicolas',
    lastName: 'Suarez',
    nickname: 'Nico',
    dni: '29888777',
    avatarUrl: '',
    status: 'claimed',
  },
  {
    id: 'p-4',
    firstName: 'Facundo',
    lastName: 'Molina',
    nickname: 'Faku',
    dni: '40111222',
    avatarUrl: '',
    status: 'unclaimed',
  },
];

export const mockProfile = {
  fullName: 'Bruno Baumgart',
  dni: '35123456',
  avatarUrl: '',
};

export const mockLinkedParticipants: TeamParticipant[] = [
  {
    id: 'p-1',
    firstName: 'Juan',
    lastName: 'Perez',
    nickname: 'JP',
    dni: '12345678',
    avatarUrl: '',
    status: 'claimed',
  },
  {
    id: 'p-7',
    firstName: 'Ezequiel',
    lastName: 'Rojas',
    nickname: 'Zequi',
    dni: '35123456',
    avatarUrl: '',
    status: 'claimed',
  },
];

export const mockLinkedTeams: LinkedTeam[] = [
  { id: 't-1', name: 'Java FC', roleLabel: 'Titular', badgeUrl: '' },
  { id: 't-2', name: 'Liga360 Juniors', roleLabel: 'Suplente', badgeUrl: '' },
];
