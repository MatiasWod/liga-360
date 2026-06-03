import React from 'react';

const STORAGE_KEY = 'liga360.fixtureSchedulingPrefs.v1';

export type PlayWindow = { start: string; end: string };

type Stored = {
  presetTimes: string[];
  windows: Record<string, PlayWindow>;
};

const DEFAULT_PRESETS = ['18:00', '20:30', '21:00'];

function readAll(): Record<string, Stored> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, Stored>;
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, Stored>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

function stageKey(tournamentId: string, stageId: string) {
  return `${tournamentId}::${stageId}`;
}

export type FixtureSchedulingAssistApi = {
  presetTimes: string[];
  setPresetTimes: (next: string[]) => void;
  addPresetTime: (hhmm: string) => void;
  removePresetTime: (hhmm: string) => void;
  getPlayWindow: (scope: string, roundId: string) => PlayWindow;
  setPlayWindow: (scope: string, roundId: string, start: string, end: string) => void;
};

/**
 * Preferencias locales (localStorage): ventana de días por fecha/ronda y horarios sugeridos.
 * `scope` = "main" para liga/eliminación, o `groupId` para fase grupos.
 */
export function useFixtureSchedulingPrefs(
  tournamentId: string | undefined,
  stageId: string | undefined
): FixtureSchedulingAssistApi | null {
  const [tick, setTick] = React.useState(0);

  const bump = React.useCallback(() => setTick((t) => t + 1), []);

  const bucket = React.useMemo(() => {
    if (!tournamentId || !stageId) return null;
    return stageKey(tournamentId, stageId);
  }, [tournamentId, stageId]);

  const readBucket = React.useCallback((): Stored => {
    if (!bucket) return { presetTimes: [...DEFAULT_PRESETS], windows: {} };
    const all = readAll();
    const cur = all[bucket];
    if (!cur) return { presetTimes: [...DEFAULT_PRESETS], windows: {} };
    return {
      presetTimes: Array.isArray(cur.presetTimes) && cur.presetTimes.length > 0 ? cur.presetTimes : [...DEFAULT_PRESETS],
      windows: cur.windows && typeof cur.windows === 'object' ? cur.windows : {},
    };
  }, [bucket, tick]);

  const persistBucket = React.useCallback(
    (next: Stored) => {
      if (!bucket) return;
      const all = readAll();
      all[bucket] = next;
      writeAll(all);
      bump();
    },
    [bucket, bump]
  );

  const winKey = (scope: string, roundId: string) => `${scope}::${roundId}`;

  return React.useMemo(() => {
    if (!bucket) return null;
    const data = readBucket();
    return {
      presetTimes: data.presetTimes,
      setPresetTimes: (next: string[]) => {
        const d = readBucket();
        persistBucket({ ...d, presetTimes: next });
      },
      addPresetTime: (hhmm: string) => {
        const t = hhmm.trim();
        if (!/^\d{1,2}:\d{2}$/.test(t)) return;
        const d = readBucket();
        if (d.presetTimes.includes(t)) return;
        persistBucket({ ...d, presetTimes: [...d.presetTimes, t].sort() });
      },
      removePresetTime: (hhmm: string) => {
        const d = readBucket();
        persistBucket({ ...d, presetTimes: d.presetTimes.filter((x) => x !== hhmm) });
      },
      getPlayWindow: (scope: string, roundId: string) => {
        const d = readBucket();
        return d.windows[winKey(scope, roundId)] ?? { start: '', end: '' };
      },
      setPlayWindow: (scope: string, roundId: string, start: string, end: string) => {
        const d = readBucket();
        const k = winKey(scope, roundId);
        const nextW = { ...d.windows };
        if (!start.trim() && !end.trim()) delete nextW[k];
        else nextW[k] = { start: start.trim(), end: end.trim() };
        persistBucket({ ...d, windows: nextW });
      },
    };
  }, [bucket, readBucket, persistBucket, tick]);
}

/** Días inclusivos entre start/end (yyyy-mm-dd). */
export function enumerateDaysInclusive(startYmd: string, endYmd: string): string[] {
  if (!startYmd || !endYmd) return [];
  const a = new Date(`${startYmd}T12:00:00`);
  const b = new Date(`${endYmd}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return [];
  if (b < a) return [];
  const out: string[] = [];
  const cur = new Date(a);
  const pad = (n: number) => String(n).padStart(2, '0');
  while (cur <= b) {
    out.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** `dateYmd` + `hh:mm` → valor para input datetime-local */
export function combineDateYmdAndTime(dateYmd: string, hhmm: string): string {
  const t = hhmm.trim();
  if (!dateYmd || !/^\d{1,2}:\d{2}$/.test(t)) return '';
  const [hh, mm] = t.split(':').map((x) => x.padStart(2, '0'));
  return `${dateYmd}T${hh}:${mm}`;
}
