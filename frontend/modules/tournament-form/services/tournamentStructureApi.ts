import { gql } from './tournamentGraphql';
import { TOURNAMENT_FOR_EDIT_QUERY } from './tournamentMapping';

export type TournamentStatusValue = 'draft' | 'published' | 'finished';

export interface TournamentGeneralPayload {
  name: string;
  sport: string;
  venue: string;
  participantType: 'teams' | 'individuals';
  inscriptionMode: 'public' | 'invitation';
  /** Solo aplica al editar: preserva/cambia el estado. La creación siempre arranca en draft. */
  status?: TournamentStatusValue;
  seriesId?: string | null;
  editionLabel?: string | null;
}

export async function createTournamentDraft(general: TournamentGeneralPayload) {
  return gql(
    `mutation CreateTournament($name: String!, $sport: String!, $season: String, $venue: String, $pt: String, $inscriptionMode: InscriptionMode!, $status: TournamentStatus!, $seriesId: ID, $editionLabel: String) {
        createTournament(name: $name, sport: $sport, season: $season, venue: $venue, participantType: $pt, inscriptionMode: $inscriptionMode, status: $status, seriesId: $seriesId, editionLabel: $editionLabel) { id name season seriesId editionLabel }
    }`,
    {
      name: general.name,
      sport: general.sport,
      season: null,
      venue: general.venue || null,
      pt: general.participantType,
      inscriptionMode: general.inscriptionMode,
      status: 'draft',
      seriesId: general.seriesId || null,
      editionLabel: general.editionLabel || null,
    }
  ).then((response: any) => response.createTournament);
}

export async function updateTournamentDraft(tournamentId: string, general: TournamentGeneralPayload) {
  return gql(
    `mutation UpdateTournament($id: ID!, $name: String!, $sport: String!, $season: String, $venue: String, $pt: String, $inscriptionMode: InscriptionMode!, $status: TournamentStatus!, $seriesId: ID, $editionLabel: String) {
        updateTournament(id: $id, name: $name, sport: $sport, season: $season, venue: $venue, participantType: $pt, inscriptionMode: $inscriptionMode, status: $status, seriesId: $seriesId, editionLabel: $editionLabel) { id name season seriesId editionLabel }
    }`,
    {
      id: tournamentId,
      name: general.name,
      sport: general.sport,
      season: null,
      venue: general.venue || null,
      pt: general.participantType,
      inscriptionMode: general.inscriptionMode,
      status: general.status ?? 'draft',
      seriesId: general.seriesId ?? null,
      editionLabel: general.editionLabel || null,
    }
  ).then((response: any) => response.updateTournament);
}

export async function createCompetition(tournamentId: string, name: string, order: number, maxSlots: number | null) {
  return gql(
    `mutation CreateCompetition($tid: ID!, $name: String!, $order: Int!, $maxSlots: Int) { createCompetition(tournamentId: $tid, name: $name, order: $order, maxSlots: $maxSlots) { id name order maxSlots effectiveMaxSlots } }`,
    { tid: tournamentId, name, order, maxSlots }
  ).then((response: any) => response.createCompetition);
}

export async function updateCompetition(competitionId: string, name: string, order: number, maxSlots: number | null) {
  return gql(
    `mutation UpdateCompetition($competitionId: ID!, $name: String!, $order: Int!, $maxSlots: Int) {
        updateCompetition(competitionId: $competitionId, name: $name, order: $order, maxSlots: $maxSlots) { id }
    }`,
    { competitionId, name, order, maxSlots }
  ).then((response: any) => response.updateCompetition);
}

export async function createStage(
  competitionId: string,
  name: string,
  order: number,
  format: 'league' | 'groups' | 'elimination' | 'composed',
  config: unknown,
  children: unknown[]
) {
  return gql(
    `mutation AddStage($cid: ID!, $name: String!, $order: Int!, $format: StageFormat!, $configJson: String, $childrenJson: String) {
        addStage(competitionId: $cid, name: $name, order: $order, format: $format, configJson: $configJson, childrenJson: $childrenJson) {
            id
        }
    }`,
    {
      cid: competitionId,
      name,
      order,
      format,
      configJson: JSON.stringify(config ?? {}),
      childrenJson: JSON.stringify(children ?? []),
    }
  ).then((response: any) => response.addStage);
}

export async function updateStage(
  stageId: string,
  name: string,
  order: number,
  format: 'league' | 'groups' | 'elimination' | 'composed',
  config: unknown,
  children: unknown[]
) {
  return gql(
    `mutation UpdateStage($stageId: ID!, $name: String!, $order: Int!, $format: StageFormat!, $configJson: String, $childrenJson: String) {
        updateStage(stageId: $stageId, name: $name, order: $order, format: $format, configJson: $configJson, childrenJson: $childrenJson) { id }
    }`,
    {
      stageId,
      name,
      order,
      format,
      configJson: JSON.stringify(config ?? {}),
      childrenJson: JSON.stringify(children ?? []),
    }
  ).then((response: any) => response.updateStage);
}

export async function generateEliminationBracket(stageId: string, doubleRound: boolean = false) {
  await gql(
    `mutation GenerateSingleEliminationBracket($stageId: ID!, $doubleRound: Boolean!) {
        generateSingleEliminationBracket(stageId: $stageId, doubleRound: $doubleRound) { id }
    }`,
    { stageId, doubleRound }
  );
}

export async function createTransition(payload: {
  from: string;
  to: string | null;
  label: string;
  selectionKind: string;
  topN: number | null;
  rangeFrom: number | null;
  rangeTo: number | null;
  bottomN: number | null;
  toExternalTournamentId: string | null;
  toExternalStageId: string | null;
  toExternalTournamentName: string | null;
  carryOverJson: string | null;
  timing?: string | null;
}) {
  const { timing, ...base } = payload;
  const transitionVars = {
    from: base.from,
    to: base.to,
    label: base.label,
    selectionKind: base.selectionKind,
    topN: base.topN,
    rangeFrom: base.rangeFrom,
    rangeTo: base.rangeTo,
    bottomN: base.bottomN,
    toExternalTournamentId: base.toExternalTournamentId,
    toExternalStageId: base.toExternalStageId,
    toExternalTournamentName: base.toExternalTournamentName,
    carryOverJson: base.carryOverJson,
  };

  // timing solo en next_edition: backends sin el arg usan in_season por defecto (Mundial, copas, etc.).
  if (timing === 'next_edition') {
    await gql(
      `mutation AddTransition(
          $from: ID!,
          $to: ID,
          $label: String!,
          $selectionKind: String!,
          $topN: Int,
          $rangeFrom: Int,
          $rangeTo: Int,
          $bottomN: Int,
          $toExternalTournamentId: String,
          $toExternalStageId: String,
          $toExternalTournamentName: String,
          $carryOverJson: String,
          $timing: String!
      ) {
          addTransition(
              fromStageId: $from,
              toStageId: $to,
              label: $label,
              selectionKind: $selectionKind,
              topN: $topN,
              rangeFrom: $rangeFrom,
              rangeTo: $rangeTo,
              bottomN: $bottomN,
              toExternalTournamentId: $toExternalTournamentId,
              toExternalStageId: $toExternalStageId,
              toExternalTournamentName: $toExternalTournamentName,
              carryOverJson: $carryOverJson,
              timing: $timing
          ) { id }
      }`,
      { ...transitionVars, timing: 'next_edition' }
    );
    return;
  }

  await gql(
    `mutation AddTransition(
        $from: ID!,
        $to: ID,
        $label: String!,
        $selectionKind: String!,
        $topN: Int,
        $rangeFrom: Int,
        $rangeTo: Int,
        $bottomN: Int,
        $toExternalTournamentId: String,
        $toExternalStageId: String,
        $toExternalTournamentName: String,
        $carryOverJson: String
    ) {
        addTransition(
            fromStageId: $from,
            toStageId: $to,
            label: $label,
            selectionKind: $selectionKind,
            topN: $topN,
            rangeFrom: $rangeFrom,
            rangeTo: $rangeTo,
            bottomN: $bottomN,
            toExternalTournamentId: $toExternalTournamentId,
            toExternalStageId: $toExternalStageId,
            toExternalTournamentName: $toExternalTournamentName,
            carryOverJson: $carryOverJson
        ) { id }
    }`,
    transitionVars
  );
}

export async function deleteTransition(transitionId: string) {
  await gql<{ deleteTransition: boolean }>(
    `mutation DeleteTransition($id: ID!) { deleteTransition(transitionId: $id) }`,
    { id: transitionId }
  );
}

export async function getTournamentForEdit(tournamentId: string) {
  const data = await gql<{ tournament: any }>(TOURNAMENT_FOR_EDIT_QUERY, { id: tournamentId });
  return data?.tournament || null;
}
