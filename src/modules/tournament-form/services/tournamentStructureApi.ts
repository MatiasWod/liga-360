import { gql } from './tournamentGraphql';
import { TOURNAMENT_FOR_EDIT_QUERY } from './tournamentMapping';

export interface TournamentGeneralPayload {
  name: string;
  sport: string;
  venue: string;
  participantType: 'teams' | 'individuals';
  inscriptionMode: 'public' | 'invitation';
  /** En actualización, si no se envía se asume borrador (solo por compatibilidad interna). */
  status?: 'draft' | 'published';
}

export async function createTournamentDraft(general: TournamentGeneralPayload) {
  return gql(
    `mutation CreateTournament($name: String!, $sport: String!, $season: String, $venue: String, $pt: String, $inscriptionMode: InscriptionMode!, $status: TournamentStatus!) {
        createTournament(name: $name, sport: $sport, season: $season, venue: $venue, participantType: $pt, inscriptionMode: $inscriptionMode, status: $status) { id name season }
    }`,
    {
      name: general.name,
      sport: general.sport,
      season: null,
      venue: general.venue || null,
      pt: general.participantType,
      inscriptionMode: general.inscriptionMode,
      status: 'draft',
    }
  ).then((response: any) => response.createTournament);
}

export async function updateTournamentDraft(tournamentId: string, general: TournamentGeneralPayload) {
  return gql(
    `mutation UpdateTournament($id: ID!, $name: String!, $sport: String!, $season: String, $venue: String, $pt: String, $inscriptionMode: InscriptionMode!, $status: TournamentStatus!) {
        updateTournament(id: $id, name: $name, sport: $sport, season: $season, venue: $venue, participantType: $pt, inscriptionMode: $inscriptionMode, status: $status) { id name season }
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

export async function generateEliminationBracket(stageId: string) {
  await gql(
    `mutation GenerateEliminationBracket($stageId: ID!) {
        generateEliminationBracket(stageId: $stageId) { id }
    }`,
    { stageId }
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
}) {
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
    payload
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
