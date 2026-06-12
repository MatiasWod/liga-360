export function resolveEditionDisplay(
  editionLabel?: string | null,
  season?: string | null
): string {
  return String(editionLabel || season || '').trim();
}
