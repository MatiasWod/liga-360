// Ad-hoc API contract verification against the live local stack (nginx proxy on :5173).
// Cross-checks the endpoints documented in ARQ_DOC against actual runtime behavior.
import crypto from 'node:crypto';

const BASE = 'http://localhost:5173/api';
const DIRECT_TEAMS = 'http://localhost:4002';
const GQL = 'http://localhost:5173/api/graphql';
const JWT_SECRET = 'devsecret';

const results = [];
function rec(group, name, ok, detail) {
  results.push({ group, name, ok, detail });
  const tag = ok === true ? 'PASS' : ok === 'warn' ? 'WARN' : 'FAIL';
  console.log(`[${tag}] ${group} :: ${name} — ${detail}`);
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function mintToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...payload }));
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

async function http(method, url, { token, body, ct = 'application/json' } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = ct;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const raw = await res.text();
  let json = null, isHtml = false;
  const t = raw.trim();
  if (t.startsWith('<')) isHtml = true;
  else { try { json = JSON.parse(raw); } catch {} }
  return { status: res.status, json, raw, isHtml };
}

const uniq = () => crypto.randomBytes(4).toString('hex');

(async () => {
  // ---------- auth-svc ----------
  const orgU = `org_${uniq()}`, teamU = `team_${uniq()}`, partU = `part_${uniq()}`;
  const pw = 'secret123';
  let orgTok, teamTok, partTok, teamUserId, partUserId;

  {
    const r = await http('POST', `${BASE}/auth/register`, { body: { mode: 'organizer', username: orgU, password: pw, name: 'Org Uno' } });
    orgTok = r.json?.token;
    rec('auth', 'POST /register (organizer)', r.status === 201 && !!orgTok, `status ${r.status}`);
  }
  {
    const r = await http('POST', `${BASE}/auth/register`, { body: { mode: 'team', username: teamU, password: pw, name: 'FC Verify' } });
    teamTok = r.json?.token; teamUserId = r.json?.user?.id;
    rec('auth', 'POST /register (team)', r.status === 201 && !!teamTok, `status ${r.status}, userId ${teamUserId}`);
  }
  {
    const r = await http('POST', `${BASE}/auth/register`, { body: { mode: 'participant', username: partU, password: pw, name: 'Juan Perez' } });
    partTok = r.json?.token; partUserId = r.json?.user?.id;
    rec('auth', 'POST /register (participant)', r.status === 201 && !!partTok, `status ${r.status}, userId ${partUserId}`);
  }
  {
    const r = await http('POST', `${BASE}/auth/register`, { body: { mode: 'bogus', username: 'x', password: '1', name: '' } });
    rec('auth', 'POST /register (validation 400)', r.status === 400 && r.json?.error?.code === 'VALIDATION_ERROR', `status ${r.status}, code ${r.json?.error?.code}`);
  }
  {
    const r = await http('POST', `${BASE}/auth/register`, { body: { mode: 'organizer', username: orgU, password: pw, name: 'dup' } });
    rec('auth', 'POST /register (duplicate 409)', r.status === 409, `status ${r.status}, code ${r.json?.error?.code}`);
  }
  {
    const r = await http('POST', `${BASE}/auth/login`, { body: { username: orgU, password: pw } });
    rec('auth', 'POST /login (ok)', r.status === 200 && !!r.json?.token, `status ${r.status}`);
  }
  {
    const r = await http('POST', `${BASE}/auth/login`, { body: { username: orgU, password: 'wrong' } });
    rec('auth', 'POST /login (bad creds 401)', r.status === 401, `status ${r.status}`);
  }

  // ---------- teams-svc ----------
  let teamId, inviteCode;
  {
    const r = await http('GET', `${BASE}/teams?mine=true`, { token: teamTok });
    teamId = r.json?.teams?.[0]?.id; inviteCode = r.json?.teams?.[0]?.invite_code;
    rec('teams', 'GET /teams?mine=true', r.status === 200 && Array.isArray(r.json?.teams), `status ${r.status}, found teamId ${teamId}`);
  }
  {
    const r = await http('GET', `${BASE}/teams?mine=true`, {}); // no token
    rec('teams', 'GET /teams?mine=true (401 without token)', r.status === 401, `status ${r.status}`);
  }
  {
    const r = await http('GET', `${BASE}/teams`, {});
    rec('teams', 'GET /teams (public list)', r.status === 200, `status ${r.status}`);
  }
  {
    const r = await http('GET', `${BASE}/teams?ownerUserId=${teamUserId}`, {});
    rec('teams', 'GET /teams?ownerUserId', r.status === 200 && Array.isArray(r.json?.teams), `status ${r.status}, n=${r.json?.teams?.length}`);
  }
  {
    const r = await http('GET', `${BASE}/teams?inviteCode=${inviteCode}`, {});
    rec('teams', 'GET /teams?inviteCode', r.status === 200, `status ${r.status}`);
  }
  {
    const r = await http('GET', `${BASE}/teams?ids=${teamId}&names=FC%20Verify`, {});
    rec('teams', 'GET /teams?ids&names', r.status === 200, `status ${r.status}`);
  }
  {
    const r = await http('POST', `${BASE}/teams`, { token: teamTok, body: { name: `Extra ${uniq()}` } });
    rec('teams', 'POST /teams', r.status === 201 && !!r.json?.id, `status ${r.status}`);
  }
  {
    const r = await http('GET', `${BASE}/teams/${teamId}`, {});
    rec('teams', 'GET /teams/:id', r.status === 200 && r.json?.id === teamId, `status ${r.status}`);
  }
  {
    const r = await http('PATCH', `${BASE}/teams/${teamId}`, { token: teamTok, body: { name: 'FC Verify Renamed' } });
    rec('teams', 'PATCH /teams/:id', r.status === 200, `status ${r.status}`);
  }
  let participantId;
  {
    const r = await http('POST', `${BASE}/teams/${teamId}/members`, { token: teamTok, body: { firstName: 'Pedro', lastName: 'Gomez' } });
    participantId = r.json?.id ?? r.json?.participant?.id;
    rec('teams', 'POST /teams/:id/members', r.status === 201 || r.status === 200, `status ${r.status}, participantId ${participantId}`);
  }
  {
    const r = await http('DELETE', `${BASE}/teams/${teamId}/members/${participantId ?? 999999}`, { token: teamTok });
    rec('teams', 'DELETE /teams/:id/members/:pid', [200, 204].includes(r.status), `status ${r.status}`);
  }
  {
    const r = await http('POST', `${BASE}/teams/${teamId}/access-code/rotate`, { token: teamTok, body: {} });
    rec('teams', 'POST /teams/:id/access-code/rotate', r.status === 200, `status ${r.status}`);
  }

  // participants — documented under teams-svc but is there an nginx route?
  {
    const r = await http('POST', `${BASE}/participants`, { token: teamTok, body: { firstName: 'Solo', lastName: 'Player' } });
    rec('teams', 'POST /api/participants (proxy reachable?)', r.isHtml ? false : true, r.isHtml ? 'returned HTML (no nginx route → SPA fallback)' : `status ${r.status}`);
  }
  {
    const r = await http('POST', `${DIRECT_TEAMS}/participants`, { token: teamTok, body: { firstName: 'Solo', lastName: 'Player' } });
    rec('teams', 'POST /participants (direct :4002)', r.status === 201 || r.status === 200, `status ${r.status}`);
  }

  // profiles
  {
    const r = await http('GET', `${BASE}/profiles/me`, { token: partTok });
    rec('profiles', 'GET /profiles/me', r.status === 200, `status ${r.status}`);
  }
  {
    const r = await http('POST', `${BASE}/profiles/me/claims`, { token: partTok, body: { dni: '12345678' } });
    rec('profiles', 'POST /profiles/me/claims', !r.isHtml && r.status < 500, `status ${r.status}`);
  }
  {
    const r = await http('DELETE', `${BASE}/profiles/me/participants/999999`, { token: partTok });
    rec('profiles', 'DELETE /profiles/me/participants/:id', !r.isHtml && r.status < 500, `status ${r.status}`);
  }
  {
    const r = await http('GET', `${BASE}/profiles?userId=${partUserId}`, {}); // no service token
    rec('profiles', 'GET /profiles (401 without service token)', r.status === 401, `status ${r.status}`);
  }
  {
    const svcTok = mintToken({ type: 'service', sub: 'verify-script' });
    const r = await http('GET', `${BASE}/profiles?userId=${partUserId}`, { token: svcTok });
    rec('profiles', 'GET /profiles?userId (service token)', r.status === 200, `status ${r.status}`);
  }

  // ---------- inscriptions-svc (smoke: routing + auth gating, no 500/HTML) ----------
  {
    const r = await http('POST', `${BASE}/inscriptions/inscriptions`, { token: teamTok, body: {} });
    rec('inscriptions', 'POST /inscriptions', !r.isHtml && r.status !== 500, `status ${r.status}`);
  }
  {
    const r = await http('PATCH', `${BASE}/inscriptions/inscriptions/1/status`, { token: partTok, body: { status: 'accepted' } });
    rec('inscriptions', 'PATCH /inscriptions/:id/status (403 non-organizer)', r.status === 403, `status ${r.status}`);
  }
  {
    const r = await http('PATCH', `${BASE}/inscriptions/inscriptions/1/competition`, { token: orgTok, body: { competitionId: 'x' } });
    rec('inscriptions', 'PATCH /inscriptions/:id/competition', !r.isHtml && r.status !== 500, `status ${r.status}`);
  }
  {
    const r = await http('GET', `${BASE}/inscriptions/inscriptions?tournamentId=1`, { token: orgTok });
    rec('inscriptions', 'GET /inscriptions?tournamentId=', !r.isHtml && r.status !== 500, `status ${r.status}`);
  }
  {
    const r = await http('GET', `${BASE}/inscriptions/invites`, { token: orgTok });
    rec('inscriptions', 'GET /invites (organizer)', !r.isHtml && r.status !== 500, `status ${r.status}`);
  }
  {
    const r = await http('POST', `${BASE}/inscriptions/invites`, { token: partTok, body: {} });
    rec('inscriptions', 'POST /invites (403 non-organizer)', r.status === 403, `status ${r.status}`);
  }
  {
    const r = await http('GET', `${BASE}/inscriptions/teams/me/invites`, { token: teamTok });
    rec('inscriptions', 'GET /teams/me/invites', !r.isHtml && r.status !== 500, `status ${r.status}`);
  }
  {
    const r = await http('GET', `${BASE}/inscriptions/participants/me/invites`, { token: partTok });
    rec('inscriptions', 'GET /participants/me/invites', !r.isHtml && r.status !== 500, `status ${r.status}`);
  }

  // ---------- matchevents-svc ----------
  {
    const r = await http('GET', `${BASE}/matches/1/events`, { token: orgTok });
    rec('matchevents', 'GET /matches/:id/events', !r.isHtml && r.status !== 500, `status ${r.status}`);
  }
  {
    const r = await http('POST', `${BASE}/matches/1/events`, { token: partTok, body: {} });
    rec('matchevents', 'POST /matches/:id/events (403 non-organizer)', r.status === 403, `status ${r.status}`);
  }
  {
    const r = await http('PATCH', `${BASE}/matches/1/events/1`, { token: orgTok, body: {} });
    rec('matchevents', 'PATCH /matches/:id/events/:eid', !r.isHtml && r.status !== 500, `status ${r.status}`);
  }
  {
    const r = await http('DELETE', `${BASE}/matches/1/events/1`, { token: orgTok });
    rec('matchevents', 'DELETE /matches/:id/events/:eid', !r.isHtml && r.status !== 500, `status ${r.status}`);
  }

  // ---------- tournaments-svc (GraphQL via gateway) ----------
  {
    const r = await http('POST', GQL, { body: { query: '{ tournaments { id name } }' } });
    const ok = r.status === 200 && r.json?.data && !r.json?.errors;
    rec('tournaments', 'query tournaments (public)', ok, `status ${r.status}${r.json?.errors ? ', errors: ' + JSON.stringify(r.json.errors[0]?.message) : ''}`);
  }
  {
    // organizer mutation — exercises the JWT_SECRET gap in tournaments-svc
    const q = 'mutation($n:String!){ createTournament(input:{name:$n}){ id name } }';
    const r = await http('POST', GQL, { token: orgTok, body: { query: q, variables: { n: `T ${uniq()}` } } });
    const created = r.json?.data?.createTournament?.id;
    const ok = r.status === 200 && created && !r.json?.errors;
    rec('tournaments', 'mutation createTournament (organizer)', ok ? true : 'warn',
      `status ${r.status}${r.json?.errors ? ', errors: ' + JSON.stringify(r.json.errors.map(e => e.message)) : created ? ', id ' + created : ''}`);
  }

  // ---------- summary ----------
  const fail = results.filter(r => r.ok === false);
  const warn = results.filter(r => r.ok === 'warn');
  console.log('\n================ SUMMARY ================');
  console.log(`total ${results.length} | pass ${results.filter(r => r.ok === true).length} | warn ${warn.length} | FAIL ${fail.length}`);
  if (fail.length) { console.log('\nFAILURES:'); fail.forEach(f => console.log(`  ✗ ${f.group} :: ${f.name} — ${f.detail}`)); }
  if (warn.length) { console.log('\nWARNINGS:'); warn.forEach(f => console.log(`  ! ${f.group} :: ${f.name} — ${f.detail}`)); }
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
