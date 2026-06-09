/** Reglas puras sobre el tipo de participante del torneo (teams / individuals). */

export function normalizeTournamentParticipantType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'team' || raw === 'teams') return 'teams';
  if (raw === 'participant' || raw === 'participants' || raw === 'individual' || raw === 'individuals') return 'individuals';
  return 'teams';
}

/** Lanza FORBIDDEN_PARTICIPANT_TYPE_MISMATCH si el rol del usuario no matchea el tipo del torneo. */
export function assertRoleMatchesParticipantType(userType, participantType) {
  if (userType === 'team' && participantType !== 'teams') {
    throw new Error('FORBIDDEN_PARTICIPANT_TYPE_MISMATCH');
  }
  if (userType === 'participant' && participantType !== 'individuals') {
    throw new Error('FORBIDDEN_PARTICIPANT_TYPE_MISMATCH');
  }
}
