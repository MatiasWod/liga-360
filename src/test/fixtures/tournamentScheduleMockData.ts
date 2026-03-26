import type { GroupsScheduleData, KnockoutScheduleData, LeagueScheduleData } from '../../components/tournament-schedule/types';

const iso = (d: string) => new Date(d).toISOString();

export const mockLeagueData: LeagueScheduleData = {
  rounds: [
    {
      id: 'r1',
      label: 'Matchday 1',
      matches: [
        {
          id: 'm1',
          homeTeam: { id: 't1', name: 'Local FC', shortName: 'LOC' },
          awayTeam: { id: 't2', name: 'Visitante UD', shortName: 'VIS' },
          scheduledAt: iso('2024-05-15T18:00:00'),
          status: 'scheduled',
        },
        {
          id: 'm2',
          homeTeam: { id: 't3', name: 'Riverside', shortName: 'RIV' },
          awayTeam: { id: 't4', name: 'North End', shortName: 'NOR' },
          scheduledAt: iso('2024-05-15T20:30:00'),
          status: 'completed',
          homeScore: 2,
          awayScore: 1,
        },
      ],
    },
    {
      id: 'r2',
      label: 'Matchday 2',
      matches: [
        {
          id: 'm3',
          homeTeam: { id: 't2', name: 'Visitante UD', shortName: 'VIS' },
          awayTeam: { id: 't3', name: 'Riverside', shortName: 'RIV' },
          scheduledAt: iso('2024-05-22T17:00:00'),
          status: 'scheduled',
        },
      ],
    },
  ],
};

export const mockGroupsData: GroupsScheduleData = {
  groups: [
    {
      id: 'ga',
      name: 'Group A',
      rounds: [
        {
          id: 'j1',
          label: 'Jornada 1',
          matches: [
            {
              id: 'g1',
              homeTeam: { id: 'a1', name: 'Alpha United', shortName: 'ALP' },
              awayTeam: { id: 'a2', name: 'Beta City', shortName: 'BET' },
              scheduledAt: iso('2024-05-10T16:00:00'),
              status: 'live',
            },
          ],
        },
        {
          id: 'j2',
          label: 'Jornada 2',
          matches: [
            {
              id: 'g2',
              homeTeam: { id: 'a2', name: 'Beta City', shortName: 'BET' },
              awayTeam: { id: 'a3', name: 'Gamma SC', shortName: 'GAM' },
              scheduledAt: iso('2024-05-17T16:00:00'),
              status: 'scheduled',
            },
          ],
        },
      ],
    },
    {
      id: 'gb',
      name: 'Group B',
      rounds: [
        {
          id: 'j1',
          label: 'Jornada 1',
          matches: [
            {
              id: 'g3',
              homeTeam: { id: 'b1', name: 'Delta FC', shortName: 'DEL' },
              awayTeam: { id: 'b2', name: 'Epsilon', shortName: 'EPS' },
              scheduledAt: iso('2024-05-10T18:00:00'),
              status: 'postponed',
            },
          ],
        },
        {
          id: 'j2',
          label: 'Jornada 2',
          matches: [
            {
              id: 'g4',
              homeTeam: { id: 'b2', name: 'Epsilon', shortName: 'EPS' },
              awayTeam: { id: 'b3', name: 'Zeta Town', shortName: 'ZET' },
              scheduledAt: iso('2024-05-17T18:00:00'),
              status: 'scheduled',
            },
          ],
        },
      ],
    },
  ],
};

export const mockKnockoutData: KnockoutScheduleData = {
  rounds: [
    {
      id: 'qf',
      label: 'Quarter-finals',
      matches: [
        {
          id: 'k1',
          homeTeam: { id: 't1', name: 'Team One', shortName: 'T1' },
          awayTeam: { id: 't2', name: 'Team Two', shortName: 'T2' },
          scheduledAt: iso('2024-06-01T15:00:00'),
          status: 'completed',
          homeScore: 3,
          awayScore: 2,
        },
        {
          id: 'k2',
          homeTeam: { id: 't3', name: 'Team Three', shortName: 'T3' },
          awayTeam: { id: 't4', name: 'Team Four', shortName: 'T4' },
          scheduledAt: iso('2024-06-01T18:00:00'),
          status: 'scheduled',
        },
      ],
    },
    {
      id: 'sf',
      label: 'Semi-finals',
      matches: [
        {
          id: 'k3',
          homeTeam: { id: 't1', name: 'Team One', shortName: 'T1' },
          awayTeam: { id: 't3', name: 'Team Three', shortName: 'T3' },
          status: 'scheduled',
        },
      ],
    },
    {
      id: 'f',
      label: 'Final',
      matches: [
        {
          id: 'k4',
          homeTeam: { id: 't1', name: 'TBD', shortName: '?' },
          awayTeam: { id: 't2', name: 'TBD', shortName: '?' },
          status: 'scheduled',
        },
      ],
    },
  ],
};

export const mockTeamOptions = [
  { id: 't1', name: 'Local FC' },
  { id: 't2', name: 'Visitante UD' },
  { id: 't3', name: 'Riverside' },
  { id: 't4', name: 'North End' },
  { id: 'a1', name: 'Alpha United' },
  { id: 'a2', name: 'Beta City' },
  { id: 'a3', name: 'Gamma SC' },
  { id: 'b1', name: 'Delta FC' },
  { id: 'b2', name: 'Epsilon' },
  { id: 'b3', name: 'Zeta Town' },
];
