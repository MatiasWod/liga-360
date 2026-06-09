#!/usr/bin/env python3
"""
Backfill de MatchEvent.competition_id: resuelve a qué Competencia pertenece cada
partido vía GraphQL (gateway) y actualiza los eventos existentes en liga360_matchevents.
Idempotente: solo toca eventos con competition_id NULL.

Uso:
  python3 scripts/backfill-matchevent-competition.py            # local (docker compose)
  GQL_URL=... DB_DSN=... python3 scripts/backfill-matchevent-competition.py
"""
import json
import os
import subprocess
import urllib.error
import urllib.request

GQL_URL = os.environ.get("GQL_URL", "http://localhost:4000/graphql")
# DSN del Postgres de matchevents (puerto del compose local por defecto)
DB_DSN = os.environ.get("DB_DSN", "postgresql://liga360:liga360@localhost:55432/liga360_matchevents")


def gql(query, variables=None):
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    req = urllib.request.Request(
        GQL_URL, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            resp = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:400]}")
    if "errors" in resp:
        raise RuntimeError(f"GQL error: {resp['errors']}")
    return resp["data"]


def psql(sql):
    """Ejecuta SQL vía psql y devuelve stdout (filas tab-separadas)."""
    r = subprocess.run(
        ["psql", DB_DSN, "-At", "-c", sql],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(f"psql error: {r.stderr[:400]}")
    return r.stdout.strip()


def main():
    rows = psql('SELECT DISTINCT tournament_id FROM "MatchEvent" WHERE competition_id IS NULL;')
    tournaments = [t for t in rows.splitlines() if t]
    if not tournaments:
        print("Nada que backfillear: todos los eventos tienen competition_id.")
        return

    print(f"Torneos con eventos sin competition_id: {len(tournaments)}")
    total_updated = 0

    for tid in tournaments:
        # Mapa match_id → competition_id recorriendo la estructura del torneo
        data = gql(
            """
            query T($id: ID!) {
              tournament(id: $id) {
                competitions {
                  id
                  stages {
                    matches { id }
                    groups { matches { id } }
                  }
                }
              }
            }
            """,
            {"id": tid},
        )
        t = data.get("tournament")
        if not t:
            print(f"  ! Torneo {tid} no encontrado en el grafo — eventos quedan NULL")
            continue

        match_to_comp = {}
        for comp in t.get("competitions") or []:
            cid = comp["id"]
            for stage in comp.get("stages") or []:
                for m in stage.get("matches") or []:
                    match_to_comp[m["id"]] = cid
                for g in stage.get("groups") or []:
                    for m in g.get("matches") or []:
                        match_to_comp[m["id"]] = cid

        if not match_to_comp:
            print(f"  ! Torneo {tid}: sin partidos en el grafo")
            continue

        # UPDATE por lotes usando VALUES
        values = ",".join(
            f"('{mid}','{cid}')" for mid, cid in match_to_comp.items()
        )
        updated = psql(
            f"""
            UPDATE "MatchEvent" me
            SET competition_id = v.cid
            FROM (VALUES {values}) AS v(mid, cid)
            WHERE me.match_id = v.mid AND me.competition_id IS NULL
            RETURNING me.id;
            """
        )
        n = len([x for x in updated.splitlines() if x])
        total_updated += n
        print(f"  ✓ {tid}: {n} eventos actualizados ({len(match_to_comp)} partidos mapeados)")

    remaining = psql('SELECT COUNT(*) FROM "MatchEvent" WHERE competition_id IS NULL;')
    print(f"\nTotal actualizado: {total_updated}. Eventos aún NULL: {remaining}")


if __name__ == "__main__":
    main()
