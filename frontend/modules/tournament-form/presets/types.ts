import type { CompetitionMeta } from '../components/CompetitionsBuilder';

export interface PresetStageInfo {
    name: string;
    description: string;
}

export interface PresetParam {
    key: string;
    label: string;
    options: number[];
    default: number;
}

export interface TournamentPreset {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    stages: PresetStageInfo[];
    warning?: string;
    params?: PresetParam[];
    createCompetitions: (params: Record<string, number>) => CompetitionMeta[];
}
