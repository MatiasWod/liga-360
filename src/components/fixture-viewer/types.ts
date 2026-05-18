/**
 * Modelo de datos del fixture para {@link FixtureViewer}.
 * Los `id` de partido deben ser únicos en todo el fixture (incluido entre fechas/grupos).
 */

export type Team = {
  id: string;
  name: string;
  shortName?: string;
  badgeUrl?: string;
};

export type Match = {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  /** ISO 8601 recomendado */
  date?: string;
  /** Texto opcional (ej. Finalizado, Programado) */
  statusLabel?: string;
  /** Marcador (edición / vista cuando el torneo está publicado) */
  homeScore?: number;
  awayScore?: number;
};

export type Round = {
  id: string;
  name: string;
  matches: Match[];
};

export type FixtureGroup = {
  id: string;
  name: string;
  rounds: Round[];
};

/** Preferencias de agenda (persistidas en localStorage desde el panel). */
export type FixtureSchedulingAssist = {
  presetTimes: string[];
  setPresetTimes: (next: string[]) => void;
  addPresetTime: (hhmm: string) => void;
  removePresetTime: (hhmm: string) => void;
  getPlayWindow: (roundId: string) => { start: string; end: string };
  setPlayWindowForRound: (roundId: string, start: string, end: string) => void;
};

type FixtureViewerBaseProps = {
  teams: Team[];
  className?: string;
  theme?: 'light' | 'dark';
  /** Sin DnD ni reordenar entre fechas (p. ej. eliminación directa). */
  disableDragDrop?: boolean;
  /** Oculta alta/baja de fechas y partidos (fixture generado en servidor). */
  disableStructureEdit?: boolean;
  /** Inputs de marcador en modo edición (torneo publicado + permisos). */
  scoreEditing?: { canEdit: boolean; saveLocked?: boolean };
};

type FixtureSchedulingFactoryProps = {
  /**
   * Asistente de ventana de días por fecha y horarios sugeridos (localStorage).
   * `scope`: `main` (liga/eliminación) o id de grupo.
   */
  schedulingAssistForScope?: (scope: string) => FixtureSchedulingAssist | null;
};

/** Liga o eliminación: `fixture` es la lista de fechas/rondas. `layout` por defecto `league`. */
export type FixtureViewerLeagueKnockoutProps = FixtureViewerBaseProps & {
  mode: 'view' | 'edit';
  layout?: 'league' | 'knockout';
  fixture: Round[];
  onChange?: (fixture: Round[]) => void;
  /** Resuelto por {@link FixtureViewer} (no usar la factory aquí). */
  schedulingAssist?: FixtureSchedulingAssist | null;
};

/** Grupos: cada grupo tiene sus propias fechas. */
export type FixtureViewerGroupsProps = FixtureViewerBaseProps &
  FixtureSchedulingFactoryProps & {
    mode: 'view' | 'edit';
    layout: 'groups';
    groups: FixtureGroup[];
    onChange?: (groups: FixtureGroup[]) => void;
  };

export type FixtureViewerProps = FixtureViewerBaseProps &
  FixtureSchedulingFactoryProps & {
    mode: 'view' | 'edit';
  } & (
    | { layout?: 'league' | 'knockout'; fixture: Round[]; groups?: undefined; onChange?: (fixture: Round[]) => void }
    | { layout: 'groups'; groups: FixtureGroup[]; fixture?: undefined; onChange?: (groups: FixtureGroup[]) => void }
  );
