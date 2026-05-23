#!/usr/bin/env python3
"""
Agrega 36 equipos al torneo Champions, genera el fixture de liga y simula
todos los partidos salvo los últimos 3 del round 8.
"""
import json, random, sys, urllib.request, urllib.error

AUTH_URL   = "http://localhost:4003"
INSC_URL   = "http://localhost:4004"
GQL_URL    = "http://localhost:4000/graphql"

TOURNAMENT_ID  = "t-1779503350639-z3neb"
COMPETITION_ID = "c-1779503350774-tuj5t"
LEAGUE_STAGE_ID = "s-1779503350798-26aqo"

TEAMS = [
    "Real Madrid", "FC Barcelona", "Manchester City", "Liverpool FC",
    "Bayern München", "PSG", "Chelsea FC", "Arsenal FC",
    "Juventus", "AC Milan", "Inter Milan", "Atlético Madrid",
    "Borussia Dortmund", "RB Leipzig", "Bayer Leverkusen", "Ajax",
    "Porto", "Benfica", "Sporting CP", "Sevilla FC",
    "Napoli", "AS Roma", "Lazio", "Atalanta",
    "Lyon", "Marseille", "Monaco", "Lille",
    "Tottenham", "Manchester United", "Newcastle", "Aston Villa",
    "Celtic", "Rangers", "Shakhtar", "Dinamo Zagreb",
]

random.seed(42)

def http(url, body=None, method=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    m = method or ("POST" if data else "GET")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=m)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body_err = e.read().decode()
        raise RuntimeError(f"HTTP {e.code} {url}: {body_err[:300]}")

def gql(query, variables=None, token=None):
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    resp = http(GQL_URL, payload, token=token)
    if "errors" in resp:
        raise RuntimeError(f"GQL error: {resp['errors']}")
    return resp["data"]

def step(msg):
    print(f"\n▶ {msg}")

def ok(msg):
    print(f"  ✓ {msg}")

# ── 1. Login ──────────────────────────────────────────────────────────────────
step("Login como organizador")
login = http(f"{AUTH_URL}/login", {"username": "organizador", "password": "SeedLiga360!"})
TOKEN = login["token"]
ok(f"Token obtenido ({TOKEN[:20]}…)")

# ── 2. Crear 36 inscripciones ─────────────────────────────────────────────────
step("Creando 36 inscripciones (manual)")
inscription_ids = []
for name in TEAMS:
    resp = http(f"{INSC_URL}/inscriptions",
        {"tournamentId": TOURNAMENT_ID, "competitionId": COMPETITION_ID,
         "displayName": name, "source": "manual"},
        token=TOKEN)
    iid = resp["inscription"]["id"]
    inscription_ids.append(iid)
    print(f"  + {name} → id={iid}")

ok(f"{len(inscription_ids)} inscripciones creadas")

# ── 3. Aprobar todas ──────────────────────────────────────────────────────────
step("Aprobando inscripciones")
for iid in inscription_ids:
    http(f"{INSC_URL}/inscriptions/{iid}/status", {"status": "ACEPTADO"}, method="PATCH", token=TOKEN)
ok("Todas aprobadas (ACEPTADO)")

# ── 4. Asignar a la etapa de liga ─────────────────────────────────────────────
step("Asignando inscripciones a la Liga única")
ASSIGN_MUTATION = """
mutation AssignToStage($stageId: ID!, $inscriptionId: ID!, $tournamentId: ID!, $displayName: String!) {
  assignInscriptionToStage(stageId: $stageId, inscriptionId: $inscriptionId, tournamentId: $tournamentId, displayName: $displayName)
}
"""
for iid, name in zip(inscription_ids, TEAMS):
    gql(ASSIGN_MUTATION, {
        "stageId": LEAGUE_STAGE_ID,
        "inscriptionId": str(iid),
        "tournamentId": TOURNAMENT_ID,
        "displayName": name,
    }, token=TOKEN)
ok(f"{len(inscription_ids)} equipos asignados a la etapa")

# ── 5. Generar el fixture de liga ─────────────────────────────────────────────
step("Generando fixture de liga (single round-robin, maxRounds=8)")
GEN_MUTATION = """
mutation GenLeague($stageId: ID!, $doubleRound: Boolean!, $maxRounds: Int) {
  generateLeagueRoundRobin(stageId: $stageId, doubleRound: $doubleRound, maxRounds: $maxRounds) {
    id round fixtureCode
  }
}
"""
data = gql(GEN_MUTATION, {
    "stageId": LEAGUE_STAGE_ID,
    "doubleRound": False,
    "maxRounds": 8,
}, token=TOKEN)
matches = data["generateLeagueRoundRobin"]
ok(f"Fixture generado: {len(matches)} partidos")

# ── 6. Obtener partidos con inscripciones asignadas ───────────────────────────
step("Obteniendo partidos con participantes")
GET_MATCHES_QUERY = """
query GetMatches($stageId: ID!) {
  stage(id: $stageId) {
    matches {
      id round slotIndex fixtureCode status
      homeAssignedInscription { inscriptionId displayName }
      awayAssignedInscription { inscriptionId displayName }
    }
  }
}
"""
# stage query might not exist — fetch via tournament
GET_MATCHES_QUERY2 = """
{
  tournament(id: "t-1779503350639-z3neb") {
    competitions {
      stages {
        id
        matches {
          id round slotIndex fixtureCode status
          homeAssignedInscription { inscriptionId displayName }
          awayAssignedInscription { inscriptionId displayName }
        }
      }
    }
  }
}
"""
data2 = gql(GET_MATCHES_QUERY2, token=TOKEN)
all_stages = data2["tournament"]["competitions"][0]["stages"]
league_stage = next(s for s in all_stages if s["id"] == LEAGUE_STAGE_ID)
all_matches = league_stage["matches"]

# Separate round 8 matches, keep last 3 unsimulated
round8 = sorted([m for m in all_matches if m["round"] == 8], key=lambda m: m["slotIndex"] or 0)
round8_skip = set(m["id"] for m in round8[-3:])
to_simulate = [m for m in all_matches if m["id"] not in round8_skip]

ok(f"Total partidos: {len(all_matches)} | A simular: {len(to_simulate)} | Sin simular (últimos 3 de fecha 8): {len(round8_skip)}")

skipped_names = [(m["homeAssignedInscription"]["displayName"] if m.get("homeAssignedInscription") else "?",
                  m["awayAssignedInscription"]["displayName"] if m.get("awayAssignedInscription") else "?")
                 for m in round8[-3:]]
print(f"  Partidos sin simular:")
for h, a in skipped_names:
    print(f"    {h} vs {a}")

# ── 7. Simular partidos ───────────────────────────────────────────────────────
step(f"Simulando {len(to_simulate)} partidos…")
UPDATE_MUTATION = """
mutation UpdateResult($matchId: ID!, $homeScore: Int!, $awayScore: Int!, $status: String!) {
  updateMatchResult(matchId: $matchId, homeScore: $homeScore, awayScore: $awayScore, status: $status) {
    id homeScore awayScore status
  }
}
"""
SCORES = [(3,0),(2,1),(1,1),(2,0),(4,1),(0,0),(1,0),(2,2),(3,2),(1,2),(0,1),(2,3),(1,3)]
for i, m in enumerate(to_simulate):
    hs, aws = random.choice(SCORES)
    gql(UPDATE_MUTATION, {
        "matchId": m["id"],
        "homeScore": hs,
        "awayScore": aws,
        "status": "finished",
    }, token=TOKEN)
    if (i + 1) % 20 == 0:
        print(f"  {i+1}/{len(to_simulate)} partidos simulados…")

ok(f"Simulación completa: {len(to_simulate)} partidos finalizados")
print("\n✅ Listo. Recargá el torneo en el navegador.")
