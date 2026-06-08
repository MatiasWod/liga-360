/** Resuelve el equipo/participante propio del usuario vía teams-svc / identity-svc. */
import * as teamsClient from '../clients/teams.client.js';
import * as identityClient from '../clients/identity.client.js';

export async function getOwnedTeamForUser(userId) {
  const teams = await teamsClient.listOwnedTeamsByUser(userId);
  if (teams.length === 0) {
    throw new Error('FORBIDDEN: tu usuario team no tiene equipo creado');
  }
  if (teams.length > 1) {
    throw new Error('FORBIDDEN: un usuario no puede gestionar multiples equipos en este flujo');
  }
  return teams[0];
}

export async function getOwnedParticipantForUser(userId) {
  const profileId = await identityClient.getProfileIdByUser(userId);
  if (!profileId) {
    throw new Error('FORBIDDEN: tu usuario participant no tiene perfil de jugador asociado');
  }
  const participants = await teamsClient.getParticipantsByProfile(profileId);
  if (participants.length === 0) {
    throw new Error('FORBIDDEN: tu usuario participant no tiene perfil de jugador asociado');
  }
  const participant = participants[0];
  const nickname = String(participant.nickname || '').trim();
  const fullName = `${String(participant.first_name || '').trim()} ${String(participant.last_name || '').trim()}`.trim();
  return {
    id: Number(participant.id),
    displayName: fullName || nickname || `Participante ${Number(participant.id)}`,
  };
}
