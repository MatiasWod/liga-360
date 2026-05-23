export type { TournamentPreset, PresetParam } from './types';
export { worldCup48 } from './worldCup48';

import { worldCup48 } from './worldCup48';
import { footballPresets } from './football';
import { tennisPresets } from './tennis';
import type { TournamentPreset } from './types';

export interface PresetCategory {
    category: string;
    presets: TournamentPreset[];
}

export const TOURNAMENT_PRESETS: PresetCategory[] = [
    {
        category: 'Fútbol',
        presets: [worldCup48, ...footballPresets],
    },
    {
        category: 'Tenis',
        presets: tennisPresets,
    },
];
