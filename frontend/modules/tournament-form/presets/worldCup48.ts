import type { TournamentPreset } from './types';
import type { CompetitionMeta } from '../components/CompetitionsBuilder';

export const worldCup48: TournamentPreset = {
    id: 'world-cup-48',
    title: 'Mundial Moderno',
    subtitle: '48 equipos · 12 grupos',
    description: 'Formato FIFA 2026: fase de grupos con 12 grupos de 4 equipos, pasan los 2 primeros de cada grupo más los 8 mejores terceros a una eliminatoria de 32.',
    stages: [
        { name: 'Fase de grupos', description: '12 grupos de 4 equipos · ida vuelta simple' },
        { name: 'Eliminatorias', description: '32 equipos · ida vuelta · Partido por 3° lugar' },
    ],
    warning: 'La clasificación de los mejores 8 terceros requiere configuración manual de la relación de pasaje.',
    createCompetitions(_params: Record<string, number>): CompetitionMeta[] {
        const groupStageId = crypto.randomUUID();
        const knockoutStageId = crypto.randomUUID();
        return [
            {
                id: crypto.randomUUID(),
                name: 'Copa del Mundo',
                maxSlots: 48,
                stages: [
                    {
                        id: groupStageId,
                        name: 'Fase de grupos',
                        kind: 'groups',
                        config: {
                            numGroups: 12,
                            teamsPerGroup: 4,
                            groupRoundType: 'single',
                        },
                        relations: [
                            {
                                id: crypto.randomUUID(),
                                label: 'Avance directo',
                                toStageId: knockoutStageId,
                                selection: { kind: 'top', count: 2 },
                            },
                            {
                                id: crypto.randomUUID(),
                                label: 'Mejor tercero',
                                toStageId: knockoutStageId,
                                selection: { kind: 'bestN', count: 8, fromPosition: 3 },
                            },
                        ],
                    },
                    {
                        id: knockoutStageId,
                        name: 'Eliminatorias',
                        kind: 'knockout',
                        config: {
                            numParticipants: 32,
                            matchesPerTie: 'single',
                            thirdPlace: 'yes',
                        },
                        relations: [],
                    },
                ],
            },
        ];
    },
};
