import { gqlRequest } from './client';

export type NextEditionMode = 'full' | 'structure_only';

export type CreateNextEditionResult = {
  tournament: {
    id: string;
    name: string;
    seriesId?: string | null;
    editionLabel?: string | null;
    status: string;
  };
  warnings: string[];
  inscriptionsCreated: number;
  permanenciesApplied: number;
  snapshotsApplied: number;
};

export async function createNextEditionFromTournament(input: {
  sourceTournamentId: string;
  editionLabel: string;
  name?: string | null;
  mode: NextEditionMode;
  seriesId?: string | null;
}): Promise<CreateNextEditionResult> {
  const data = await gqlRequest<{ createNextEditionFromTournament: CreateNextEditionResult }>(
    `mutation CreateNextEditionFromTournament(
      $sourceTournamentId: ID!
      $editionLabel: String!
      $name: String
      $mode: NextEditionMode!
      $seriesId: ID
    ) {
      createNextEditionFromTournament(
        sourceTournamentId: $sourceTournamentId
        editionLabel: $editionLabel
        name: $name
        mode: $mode
        seriesId: $seriesId
      ) {
        tournament { id name status seriesId editionLabel }
        warnings
        inscriptionsCreated
        permanenciesApplied
        snapshotsApplied
      }
    }`,
    {
      sourceTournamentId: input.sourceTournamentId,
      editionLabel: input.editionLabel,
      name: input.name || null,
      mode: input.mode,
      seriesId: input.seriesId || null,
    },
    { auth: true }
  );
  return data.createNextEditionFromTournament;
}

/** Nombre por defecto de la nueva edición: mismo que el torneo fuente (editable en el modal). */
export function defaultNextEditionName(sourceName?: string | null): string {
  return String(sourceName || '').trim();
}

export function suggestNextEditionLabel(current?: string | null): string {
  const raw = String(current || '').trim();
  const yearMatch = raw.match(/(20\d{2})/);
  if (yearMatch) {
    const nextYear = Number(yearMatch[1]) + 1;
    return raw.replace(yearMatch[1], String(nextYear));
  }
  const y = new Date().getFullYear() + 1;
  return raw ? `${raw} (${y})` : String(y);
}
