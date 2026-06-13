import { gqlRequest } from './client';

export type SeriesEdition = {
  tournamentId: string;
  name: string;
  status: 'draft' | 'published' | 'finished' | string;
  editionLabel?: string | null;
  season?: string | null;
  categoryLabel?: string | null;
};

export type CompetitionSeries = {
  id: string;
  name: string;
  slug: string;
  sport: string;
  organizer?: string | null;
  editions: SeriesEdition[];
};

export type SeriesPodiumEntry = {
  inscriptionId: string;
  displayName: string;
  linkedTeamId?: string | null;
};

export type SeriesRollOfHonorRow = {
  editionLabel?: string | null;
  tournamentId: string;
  tournamentName: string;
  champion?: SeriesPodiumEntry | null;
  runnerUp?: SeriesPodiumEntry | null;
  thirdPlace?: SeriesPodiumEntry | null;
};

export type SeriesTitleEntry = {
  teamKey: string;
  displayName: string;
  linkedTeamId?: string | null;
  titles: number;
  identityApproximate: boolean;
};

export type SeriesScorerEntry = {
  playerKey: string;
  displayName: string;
  goals: number;
  linkedMemberId?: string | null;
  identityApproximate: boolean;
};

export type SeriesAggregates = {
  seriesId: string;
  rollOfHonor: SeriesRollOfHonorRow[];
  editionsInProgress: SeriesEdition[];
  titlesByTeam: SeriesTitleEntry[];
  topScorers: SeriesScorerEntry[];
  finishedTournamentIds: string[];
};

export async function listCompetitionSeries(): Promise<CompetitionSeries[]> {
  const data = await gqlRequest<{ competitionSeriesList?: CompetitionSeries[] }>(`
    query CompetitionSeriesList {
      competitionSeriesList {
        id
        name
        slug
        sport
        organizer
        editions {
          tournamentId
          name
          status
          editionLabel
          season
          categoryLabel
        }
      }
    }
  `);
  return Array.isArray(data?.competitionSeriesList) ? data.competitionSeriesList : [];
}

export async function getCompetitionSeriesBySlug(slug: string): Promise<CompetitionSeries | null> {
  const data = await gqlRequest<{ competitionSeries?: CompetitionSeries | null }>(
    `
    query CompetitionSeriesBySlug($slug: String!) {
      competitionSeries(slug: $slug) {
        id
        name
        slug
        sport
        organizer
        editions {
          tournamentId
          name
          status
          editionLabel
          season
          categoryLabel
        }
      }
    }
  `,
    { slug }
  );
  return data?.competitionSeries ?? null;
}

export async function getCompetitionSeriesById(id: string): Promise<CompetitionSeries | null> {
  const data = await gqlRequest<{ competitionSeries?: CompetitionSeries | null }>(
    `
    query CompetitionSeriesById($id: ID!) {
      competitionSeries(id: $id) {
        id
        name
        slug
        sport
        organizer
        editions {
          tournamentId
          name
          status
          editionLabel
          season
          categoryLabel
        }
      }
    }
  `,
    { id }
  );
  return data?.competitionSeries ?? null;
}

export async function getSeriesAggregates(seriesId: string, categoryLabel?: string | null): Promise<SeriesAggregates | null> {
  const data = await gqlRequest<{ seriesAggregates?: SeriesAggregates | null }>(
    `
    query SeriesAggregates($seriesId: ID!, $categoryLabel: String) {
      seriesAggregates(seriesId: $seriesId, categoryLabel: $categoryLabel) {
        seriesId
        finishedTournamentIds
        rollOfHonor {
          editionLabel
          tournamentId
          tournamentName
          champion { inscriptionId displayName linkedTeamId }
          runnerUp { inscriptionId displayName linkedTeamId }
          thirdPlace { inscriptionId displayName linkedTeamId }
        }
        editionsInProgress {
          tournamentId
          name
          status
          editionLabel
          season
          categoryLabel
        }
        titlesByTeam {
          teamKey
          displayName
          linkedTeamId
          titles
          identityApproximate
        }
        topScorers {
          playerKey
          displayName
          goals
          linkedMemberId
          identityApproximate
        }
      }
    }
  `,
    { seriesId, categoryLabel: categoryLabel ?? null }
  );
  return data?.seriesAggregates ?? null;
}

export async function listOrganizerSeries(): Promise<CompetitionSeries[]> {
  const data = await gqlRequest<{ myCompetitionSeries?: CompetitionSeries[] }>(`
    query MyCompetitionSeries {
      myCompetitionSeries {
        id
        name
        slug
        sport
      }
    }
  `);
  return Array.isArray(data?.myCompetitionSeries) ? data.myCompetitionSeries : [];
}

export async function createCompetitionSeries(input: {
  name: string;
  slug: string;
  sport?: string;
}): Promise<CompetitionSeries> {
  const data = await gqlRequest<{ createCompetitionSeries: CompetitionSeries }>(
    `
    mutation CreateCompetitionSeries($name: String!, $slug: String!, $sport: String!) {
      createCompetitionSeries(name: $name, slug: $slug, sport: $sport) {
        id
        name
        slug
        sport
      }
    }
  `,
    { name: input.name, slug: input.slug, sport: input.sport || 'football' }
  );
  return data.createCompetitionSeries;
}
