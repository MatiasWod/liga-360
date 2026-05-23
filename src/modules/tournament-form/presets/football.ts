import type { TournamentPreset } from './types';
import type { CompetitionMeta } from '../components/CompetitionsBuilder';

const mundialClasico: TournamentPreset = {
    id: 'mundial-clasico',
    title: 'Mundial Clásico',
    subtitle: '32 equipos · 8 grupos',
    description: 'Formato FIFA 1998–2022: 8 grupos de 4 equipos, los 2 primeros de cada grupo avanzan a una eliminatoria de 16.',
    stages: [
        { name: 'Fase de grupos', description: '8 grupos de 4 equipos · solo ida' },
        { name: 'Eliminatorias', description: '16 equipos · partido único · tercer puesto' },
    ],
    createCompetitions(_params: Record<string, number>): CompetitionMeta[] {
        const groupStageId = crypto.randomUUID();
        const knockoutStageId = crypto.randomUUID();
        return [{
            id: crypto.randomUUID(),
            name: 'Copa del Mundo',
            maxSlots: 32,
            stages: [
                {
                    id: groupStageId,
                    name: 'Fase de grupos',
                    kind: 'groups',
                    config: { numGroups: 8, teamsPerGroup: 4, groupRoundType: 'single' },
                    relations: [{
                        id: crypto.randomUUID(),
                        label: 'Avance directo',
                        toStageId: knockoutStageId,
                        selection: { kind: 'top', count: 2 },
                    }],
                },
                {
                    id: knockoutStageId,
                    name: 'Eliminatorias',
                    kind: 'knockout',
                    config: { numParticipants: 16, matchesPerTie: 'single', thirdPlace: 'yes' },
                    relations: [],
                },
            ],
        }];
    },
};

const copaLibertadores: TournamentPreset = {
    id: 'copa-libertadores',
    title: 'Copa Libertadores',
    subtitle: '32+ equipos · 3 fases',
    description: 'Formato oficial CONMEBOL: clasificación previa por eliminación directa, fase de grupos y eliminatorias con final de partido único.',
    stages: [
        { name: 'Clasificación', description: 'Knockout · ida y vuelta' },
        { name: 'Fase de grupos', description: '8 grupos de 4 · ida y vuelta' },
        { name: 'Eliminatorias', description: '16 equipos · ida y vuelta hasta semis · final único' },
    ],
    warning: 'Los terceros de cada grupo que descenderían a Copa Sudamericana no tienen relación automática. Configurar manualmente si se desea.',
    createCompetitions(_params: Record<string, number>): CompetitionMeta[] {
        const clasificacionStageId = crypto.randomUUID();
        const gruposStageId = crypto.randomUUID();
        const eliminatoriaStageId = crypto.randomUUID();
        return [
            {
                id: crypto.randomUUID(),
                name: 'Clasificación',
                maxSlots: null,
                stages: [{
                    id: clasificacionStageId,
                    name: 'Play-in',
                    kind: 'knockout',
                    config: { numParticipants: 16, matchesPerTie: 'double', finalMatchesPerTie: 'single', thirdPlace: 'no' },
                    relations: [{
                        id: crypto.randomUUID(),
                        label: 'Clasifican a grupos',
                        toExternal: { tournamentId: 'this', stageId: gruposStageId },
                        selection: { kind: 'top', count: 8 },
                    }],
                }],
            },
            {
                id: crypto.randomUUID(),
                name: 'Fase de grupos',
                maxSlots: 32,
                stages: [{
                    id: gruposStageId,
                    name: 'Grupos',
                    kind: 'groups',
                    config: { numGroups: 8, teamsPerGroup: 4, groupRoundType: 'double' },
                    relations: [{
                        id: crypto.randomUUID(),
                        label: 'Avanzan a octavos',
                        toStageId: eliminatoriaStageId,
                        selection: { kind: 'top', count: 2 },
                    }],
                }],
            },
            {
                id: crypto.randomUUID(),
                name: 'Eliminatorias',
                maxSlots: 16,
                stages: [{
                    id: eliminatoriaStageId,
                    name: 'Eliminatorias',
                    kind: 'knockout',
                    config: { numParticipants: 16, matchesPerTie: 'double', finalMatchesPerTie: 'single', thirdPlace: 'no', numAdvancing: 1 },
                    relations: [],
                }],
            },
        ];
    },
};

const championsLeague2024: TournamentPreset = {
    id: 'champions-league-2024',
    title: 'UEFA Champions League',
    subtitle: '36 equipos · liga + repechaje + eliminatorias',
    description: 'Formato UEFA 2024+: liga única de 36 equipos (sistema suizo), los 8 primeros pasan directo a octavos, los puestos 9–24 juegan un repechaje de ida y vuelta, y los 25–36 quedan eliminados.',
    stages: [
        { name: 'Liga única', description: '36 equipos · sistema suizo · 8 partidos por equipo' },
        { name: 'Repechaje', description: 'Puestos 9–24 · ida y vuelta · 8 clasificados' },
        { name: 'Eliminatorias', description: '16 equipos · octavos a semis ida y vuelta · final único' },
    ],
    warning: 'La liga única usa un sistema suizo (rivales asignados por ranking), no round-robin fijo — el fixture genera 8 fechas con emparejamientos de round-robin, ajustar los cruces manualmente si se requiere. La final es partido único — configurar ese partido manualmente dentro del stage de Eliminatorias.',
    createCompetitions(_params: Record<string, number>): CompetitionMeta[] {
        const ligaStageId = crypto.randomUUID();
        const repechajeStageId = crypto.randomUUID();
        const eliminatoriasStageId = crypto.randomUUID();
        return [{
            id: crypto.randomUUID(),
            name: 'UEFA Champions League',
            maxSlots: 36,
            stages: [
                {
                    id: ligaStageId,
                    name: 'Liga única',
                    kind: 'league',
                    config: { numParticipants: 36, rounds: 'single', maxRounds: 8 },
                    relations: [
                        {
                            id: crypto.randomUUID(),
                            label: 'Clasificación directa',
                            toStageId: eliminatoriasStageId,
                            selection: { kind: 'top', count: 8 },
                        },
                        {
                            id: crypto.randomUUID(),
                            label: 'Repechaje',
                            toStageId: repechajeStageId,
                            selection: { kind: 'range', from: 9, to: 24 },
                        },
                    ],
                },
                {
                    id: repechajeStageId,
                    name: 'Repechaje',
                    kind: 'knockout',
                    config: { numParticipants: 16, matchesPerTie: 'double', thirdPlace: 'no', numAdvancing: 8 },
                    relations: [{
                        id: '__advancing__',
                        label: 'Clasificados',
                        toStageId: eliminatoriasStageId,
                        selection: { kind: 'top', count: 8 },
                    }],
                },
                {
                    id: eliminatoriasStageId,
                    name: 'Eliminatorias',
                    kind: 'knockout',
                    config: { numParticipants: 16, matchesPerTie: 'double', finalMatchesPerTie: 'single', thirdPlace: 'no', numAdvancing: 1 },
                    relations: [],
                },
            ],
        }];
    },
};

const ligaEuropeaClasica: TournamentPreset = {
    id: 'liga-europea-clasica',
    title: 'Liga Europea Clásica',
    subtitle: '20 equipos · liga pura',
    description: 'Formato Premier League: 20 equipos en liga completa ida y vuelta. Los primeros 4 clasifican a Europa, los últimos 3 descienden.',
    stages: [
        { name: 'Liga', description: '20 equipos · ida y vuelta · 38 jornadas' },
    ],
    warning: 'Las relaciones de clasificación internacional y descenso no tienen etapa destino dentro de este torneo. Configurar manualmente si se encadena con otra competición.',
    createCompetitions(_params: Record<string, number>): CompetitionMeta[] {
        return [{
            id: crypto.randomUUID(),
            name: 'Liga',
            maxSlots: 20,
            stages: [{
                id: crypto.randomUUID(),
                name: 'Liga regular',
                kind: 'league',
                config: { numParticipants: 20, rounds: 'double' },
                relations: [
                    {
                        id: crypto.randomUUID(),
                        label: 'Campeón',
                        selection: { kind: 'top', count: 1 },
                    },
                    {
                        id: crypto.randomUUID(),
                        label: 'Clasificación internacional',
                        selection: { kind: 'top', count: 4 },
                    },
                    {
                        id: crypto.randomUUID(),
                        label: 'Descenso',
                        selection: { kind: 'bottom', count: 3 },
                    },
                ],
            }],
        }];
    },
};

const ligaPlayoffAscenso: TournamentPreset = {
    id: 'liga-playoff-ascenso',
    title: 'Liga con Playoff de Ascenso',
    subtitle: '24 equipos · liga + playoff',
    description: 'Formato EFL Championship: liga de 24 equipos. Los 2 primeros ascienden directo, los puestos 3–6 juegan un playoff, los últimos 3 descienden.',
    stages: [
        { name: 'Liga regular', description: '24 equipos · ida y vuelta' },
        { name: 'Playoff de ascenso', description: '4 equipos · semis ida y vuelta · final único' },
    ],
    createCompetitions(_params: Record<string, number>): CompetitionMeta[] {
        const leagueStageId = crypto.randomUUID();
        const playoffStageId = crypto.randomUUID();
        return [{
            id: crypto.randomUUID(),
            name: 'Temporada',
            maxSlots: 24,
            stages: [
                {
                    id: leagueStageId,
                    name: 'Liga regular',
                    kind: 'league',
                    config: { numParticipants: 24, rounds: 'double' },
                    relations: [
                        {
                            id: crypto.randomUUID(),
                            label: 'Ascenso directo',
                            selection: { kind: 'top', count: 2 },
                        },
                        {
                            id: crypto.randomUUID(),
                            label: 'Playoff de ascenso',
                            toStageId: playoffStageId,
                            selection: { kind: 'range', from: 3, to: 6 },
                        },
                        {
                            id: crypto.randomUUID(),
                            label: 'Descenso',
                            selection: { kind: 'bottom', count: 3 },
                        },
                    ],
                },
                {
                    id: playoffStageId,
                    name: 'Playoff de ascenso',
                    kind: 'knockout',
                    config: { numParticipants: 4, matchesPerTie: 'double', finalMatchesPerTie: 'single', thirdPlace: 'no', numAdvancing: 1 },
                    relations: [],
                },
            ],
        }];
    },
};

const sistemaLigas: TournamentPreset = {
    id: 'sistema-ligas',
    title: 'Sistema de Ligas',
    subtitle: 'N divisiones · ascensos y descensos',
    description: 'Liga completa con múltiples divisiones. Configurable: cantidad de divisiones, equipos por división y cupos de ascenso/descenso entre ellas.',
    stages: [
        { name: 'Cada división', description: 'Liga ida y vuelta · ascensos y descensos automáticos' },
    ],
    params: [
        { key: 'numDivisions',      label: 'Divisiones',       options: [1, 2, 3, 4],          default: 2  },
        { key: 'teamsPerDivision',  label: 'Equipos por div.', options: [10, 12, 16, 18, 20],  default: 16 },
        { key: 'promotions',        label: 'Ascensos',         options: [1, 2, 3],              default: 2  },
        { key: 'relegations',       label: 'Descensos',        options: [1, 2, 3],              default: 3  },
    ],
    createCompetitions(params: Record<string, number>): CompetitionMeta[] {
        const numDivisions     = params.numDivisions     ?? 2;
        const teamsPerDivision = params.teamsPerDivision ?? 16;
        const promotions       = params.promotions       ?? 2;
        const relegations      = params.relegations      ?? 3;

        // Pre-generar IDs de stage para poder referenciarlos en relaciones cross
        const stageIds: string[] = Array.from({ length: numDivisions }, () => crypto.randomUUID());

        return Array.from({ length: numDivisions }, (_, i) => {
            const divNum = i + 1;
            const isFirst = i === 0;
            const isLast  = i === numDivisions - 1;
            const relations: CompetitionMeta['stages'][number]['relations'] = [];

            // Ascenso: División i+1 → División i (excepto la primera)
            if (!isFirst) {
                relations.push({
                    id: crypto.randomUUID(),
                    label: `Ascenso a División ${divNum - 1}`,
                    toExternal: { tournamentId: 'this', stageId: stageIds[i - 1] },
                    selection: { kind: 'top', count: promotions },
                });
            }

            // Descenso: División i → División i+1 (excepto la última)
            if (!isLast) {
                relations.push({
                    id: crypto.randomUUID(),
                    label: `Descenso a División ${divNum + 1}`,
                    toExternal: { tournamentId: 'this', stageId: stageIds[i + 1] },
                    selection: { kind: 'bottom', count: relegations },
                });
            }

            return {
                id: crypto.randomUUID(),
                name: `División ${divNum}`,
                maxSlots: teamsPerDivision,
                stages: [{
                    id: stageIds[i],
                    name: `División ${divNum}`,
                    kind: 'league',
                    config: { numParticipants: teamsPerDivision, rounds: 'double' },
                    relations,
                }],
            };
        });
    },
};

export const footballPresets: TournamentPreset[] = [
    mundialClasico,
    copaLibertadores,
    championsLeague2024,
    ligaEuropeaClasica,
    ligaPlayoffAscenso,
    sistemaLigas,
];
