export const MAX_CATEGORY_LABEL_LENGTH = 30;

export const CATEGORY_LABEL_SUGGESTIONS = ['Femenino', 'Masculino', 'Sub-23', '+60'] as const;

const ALLOWED_PATTERN = /^[\p{L}\p{N}+\- ]+$/u;

export function normalizeCategoryLabelInput(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const trimmed = String(raw).trim();
  if (trimmed.length > MAX_CATEGORY_LABEL_LENGTH) {
    throw new Error(`La etiqueta de categoría no puede superar ${MAX_CATEGORY_LABEL_LENGTH} caracteres`);
  }
  if (!ALLOWED_PATTERN.test(trimmed)) {
    throw new Error('La etiqueta de categoría solo admite letras, números, +, - y espacios');
  }
  return trimmed;
}

/** Valida chips de creación: sin duplicados (trim, case-insensitive). 0 chips → [null]. */
export function resolveCategoryLabelsForCreate(chips: string[]): Array<string | null> {
  if (!chips.length) return [null];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chip of chips) {
    const normalized = normalizeCategoryLabelInput(chip);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`La categoría "${normalized}" está duplicada`);
    }
    seen.add(key);
    out.push(normalized);
  }
  return out.length ? out : [null];
}

export type TournamentVariantRef = {
  id: string;
  name: string;
  organizer?: string | null;
  categoryLabel?: string | null;
};

function normKey(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

/** Hermanos por mismo nombre + organizador (MVP sin nodo de agrupación). */
export function findSiblingTournamentVariants(
  all: TournamentVariantRef[],
  current: TournamentVariantRef
): TournamentVariantRef[] {
  const nameKey = normKey(current.name);
  const orgKey = normKey(current.organizer);
  if (!nameKey || !orgKey) return [current];
  const siblings = all.filter(
    (row) => normKey(row.name) === nameKey && normKey(row.organizer) === orgKey
  );
  return siblings.sort((a, b) => {
    const la = a.categoryLabel?.trim() || '';
    const lb = b.categoryLabel?.trim() || '';
    if (!la && lb) return 1;
    if (la && !lb) return -1;
    return la.localeCompare(lb, 'es', { sensitivity: 'base' });
  });
}

export function categoryVariantPillLabel(categoryLabel?: string | null): string {
  const trimmed = String(categoryLabel ?? '').trim();
  return trimmed || 'Sin categoría';
}
