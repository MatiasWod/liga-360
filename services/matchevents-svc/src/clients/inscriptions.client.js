/** Cliente HTTP hacia inscriptions-svc (endpoint interno de lookup por id). */
import { env } from '../config/env.js';
import { svcGet } from './http.js';

/** Devuelve la inscripción (snake_case) o null si no existe. */
export async function getInscription(inscriptionId) {
  const json = await svcGet(env.inscriptionsSvcUrl, `/inscriptions/${Number(inscriptionId)}`);
  return json?.inscription ?? null;
}
