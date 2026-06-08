export function validateCreateInvite({ tournamentId, type, targetInscriptionId, targetTeamCode, targetParticipantUserId, maxUses }) {
  const errors = [];
  if (!tournamentId) errors.push({ field: 'tournamentId', message: 'tournamentId requerido' });
  if (!['public', 'targeted'].includes(type)) errors.push({ field: 'type', message: 'type invalido' });
  if (type === 'targeted' && !targetInscriptionId && !targetTeamCode && !targetParticipantUserId) {
    errors.push({ field: 'target', message: 'targetInscriptionId, targetTeamCode o targetParticipantUserId requerido para type=targeted' });
  }
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
    errors.push({ field: 'maxUses', message: 'maxUses debe ser entero positivo o null' });
  }
  return errors;
}
