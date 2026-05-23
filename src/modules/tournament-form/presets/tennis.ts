import type { TournamentPreset } from './types';
import type { CompetitionMeta } from '../components/CompetitionsBuilder';

const atpFinals: TournamentPreset = {
    id: 'atp-finals',
    title: 'ATP Finals',
    subtitle: '8 jugadores · grupos + semis',
    description: 'Formato Nitto ATP Finals: 2 grupos de 4 jugadores en todos contra todos, los 2 primeros de cada grupo avanzan a semifinales.',
    stages: [
        { name: 'Fase de grupos', description: '2 grupos de 4 · todos contra todos' },
        { name: 'Semifinales y Final', description: '4 jugadores · partido único · sin tercer puesto' },
    ],
    createCompetitions(_params: Record<string, number>): CompetitionMeta[] {
        const groupStageId = crypto.randomUUID();
        const knockoutStageId = crypto.randomUUID();
        return [{
            id: crypto.randomUUID(),
            name: 'ATP Finals',
            maxSlots: 8,
            stages: [
                {
                    id: groupStageId,
                    name: 'Fase de grupos',
                    kind: 'groups',
                    config: { numGroups: 2, teamsPerGroup: 4, groupRoundType: 'single' },
                    relations: [{
                        id: crypto.randomUUID(),
                        label: 'Clasifican a semis',
                        toStageId: knockoutStageId,
                        selection: { kind: 'top', count: 2 },
                    }],
                },
                {
                    id: knockoutStageId,
                    name: 'Semifinales y Final',
                    kind: 'knockout',
                    config: { numParticipants: 4, matchesPerTie: 'single', thirdPlace: 'no' },
                    relations: [],
                },
            ],
        }];
    },
};

const grandSlamAtp: TournamentPreset = {
    id: 'grand-slam-atp',
    title: 'Grand Slam ATP',
    subtitle: '128 jugadores · eliminación directa',
    description: 'Formato Wimbledon / US Open / Roland Garros / Australian Open: 128 jugadores en eliminación directa pura, partido único por ronda.',
    stages: [
        { name: 'Cuadro principal', description: '128 jugadores · partido único · 7 rondas' },
    ],
    createCompetitions(_params: Record<string, number>): CompetitionMeta[] {
        return [{
            id: crypto.randomUUID(),
            name: 'Cuadro principal',
            maxSlots: 128,
            stages: [{
                id: crypto.randomUUID(),
                name: 'Cuadro principal',
                kind: 'knockout',
                config: { numParticipants: 128, matchesPerTie: 'single', thirdPlace: 'no' },
                relations: [],
            }],
        }];
    },
};

const copaDavis: TournamentPreset = {
    id: 'copa-davis',
    title: 'Copa Davis',
    subtitle: '16 países · grupos + eliminatoria',
    description: 'Formato Copa Davis Finals: 4 grupos de 4 países, el primero de cada grupo y los 4 mejores segundos avanzan a cuartos de final.',
    stages: [
        { name: 'Fase de grupos', description: '4 grupos de 4 países · todos contra todos' },
        { name: 'Eliminatorias', description: '8 países · cuartos + semis + final' },
    ],
    warning: 'Cada "partido" representa una serie completa entre países (4 singles + 1 doble). Los resultados parciales de la serie deben gestionarse manualmente fuera del sistema de fixtures.',
    createCompetitions(_params: Record<string, number>): CompetitionMeta[] {
        const groupStageId = crypto.randomUUID();
        const knockoutStageId = crypto.randomUUID();
        return [{
            id: crypto.randomUUID(),
            name: 'Copa Davis Finals',
            maxSlots: 16,
            stages: [
                {
                    id: groupStageId,
                    name: 'Fase de grupos',
                    kind: 'groups',
                    config: { numGroups: 4, teamsPerGroup: 4, groupRoundType: 'single' },
                    relations: [
                        {
                            id: crypto.randomUUID(),
                            label: 'Primeros de grupo',
                            toStageId: knockoutStageId,
                            selection: { kind: 'top', count: 1 },
                        },
                        {
                            id: crypto.randomUUID(),
                            label: 'Mejores 4 segundos',
                            toStageId: knockoutStageId,
                            selection: { kind: 'bestN', count: 4, fromPosition: 2 },
                        },
                    ],
                },
                {
                    id: knockoutStageId,
                    name: 'Eliminatorias',
                    kind: 'knockout',
                    config: { numParticipants: 8, matchesPerTie: 'double', thirdPlace: 'no', numAdvancing: 1 },
                    relations: [],
                },
            ],
        }];
    },
};

export const tennisPresets: TournamentPreset[] = [
    atpFinals,
    grandSlamAtp,
    copaDavis,
];
