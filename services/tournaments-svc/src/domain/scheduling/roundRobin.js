/**
 * Calendario todos contra todos (una ronda).
 * Para N impar se usa un equipo "descanso" (bye) representado como null.
 * Cada partido es { homeSeed: number|null, awaySeed: number|null } con seeds en [0, N-1].
 */

export function singleRoundRobinSchedule(numTeams) {
  const n = Number(numTeams);
  if (!Number.isInteger(n) || n < 2) {
    return [];
  }

  const teams = Array.from({ length: n }, (_, i) => i);
  if (n % 2 === 1) {
    teams.push(null);
  }
  const m = teams.length;
  const rounds = m - 1;
  const half = m / 2;
  const arr = [...teams];
  const schedule = [];

  for (let r = 0; r < rounds; r += 1) {
    const roundMatches = [];
    for (let i = 0; i < half; i += 1) {
      const a = arr[i];
      const b = arr[m - 1 - i];
      if (a !== null && b !== null) {
        roundMatches.push({ homeSeed: a, awaySeed: b });
      } else if (a !== null) {
        roundMatches.push({ homeSeed: a, awaySeed: null });
      } else if (b !== null) {
        roundMatches.push({ homeSeed: b, awaySeed: null });
      }
    }
    schedule.push(roundMatches);
    const last = arr[m - 1];
    for (let j = m - 1; j >= 2; j -= 1) {
      arr[j] = arr[j - 1];
    }
    arr[1] = last;
  }

  return schedule;
}

export function countRoundRobinMatchesSingle(numTeams) {
  const n = Number(numTeams);
  if (!Number.isInteger(n) || n < 2) return 0;
  return (n * (n - 1)) / 2;
}

export function validateSingleRoundRobin(schedule, numTeams) {
  const n = Number(numTeams);
  if (!Number.isInteger(n) || n < 2) return { ok: false, reason: 'bad_n' };
  const expected = countRoundRobinMatchesSingle(n);
  const pairs = new Set();
  let total = 0;
  for (const round of schedule) {
    for (const m of round) {
      const { homeSeed, awaySeed } = m;
      if (homeSeed == null && awaySeed == null) continue;
      if (homeSeed != null && awaySeed != null) {
        const x = Math.min(homeSeed, awaySeed);
        const y = Math.max(homeSeed, awaySeed);
        const key = `${x},${y}`;
        if (pairs.has(key)) return { ok: false, reason: 'duplicate_pair', key };
        pairs.add(key);
        total += 1;
      }
    }
  }
  if (total !== expected) return { ok: false, reason: 'count_mismatch', total, expected };
  if (pairs.size !== expected) return { ok: false, reason: 'set_size' };
  return { ok: true };
}

export function doubleRoundRobinFromSingle(singleSchedule) {
  const second = singleSchedule.map((round) =>
    round.map((m) => {
      if (m.homeSeed == null && m.awaySeed == null) return { ...m };
      if (m.awaySeed == null) return { homeSeed: m.homeSeed, awaySeed: null };
      if (m.homeSeed == null) return { homeSeed: m.awaySeed, awaySeed: null };
      return { homeSeed: m.awaySeed, awaySeed: m.homeSeed };
    })
  );
  return [...singleSchedule, ...second];
}
