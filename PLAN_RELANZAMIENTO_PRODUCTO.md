# Liga360 — Plan de relanzamiento como producto (post-cursada)

Documento de decisión y ejecución. Contexto: se termina el crédito gratuito de AWS Academy y el objetivo deja de ser "aprobar la materia" para pasar a "tener clientes reales". Este documento define arquitectura de destino, costos, plan de migración y qué **no** tocar.

Premisa de partida acordada: **el frontend se reescribe desde cero** (Lovable u otra herramienta de iteración rápida). El backend (microservicios + modelos de datos) es el activo fuerte del proyecto y no se reescribe — se **muda** de infraestructura, no de arquitectura.

---

## 1. Resumen ejecutivo

| Decisión | Elección | Por qué |
|---|---|---|
| Frontend | Reescribir en Lovable, deploy en **Vercel** | Lovable itera rápido en UI/mobile; Vercel es el destino natural para un SPA Vite/React y tiene integración nativa con Lovable vía GitHub. |
| Backend (6 servicios + gateway) | **Railway**, mismos Dockerfiles que ya usan en k8s | Railway es container-native: se despliega el mismo `Dockerfile` de cada servicio sin reescribir una línea. Render es la alternativa si Railway no cierra en costo (ver §3). |
| Neo4j | **Neo4j AuraDB** (Free para arrancar, Professional cuando haya clientes pagos) | Sacar el StatefulSet de la ecuación. Ninguna plataforma de contenedores gratuita maneja bien una base con estado y volumen persistente. |
| Postgres | **Neon** (o Postgres nativo de Railway si se prefiere todo en un solo panel) | Free tier generoso, scale-to-zero, no fuerza a mezclar infra de datos con infra de cómputo. |
| Ruteo API | **Rewrites de Vercel** replicando el `nginx.conf` actual | Mantiene el frontend hablando con rutas relativas `/api/*` tal cual hoy, sin tocar código de servicios, sin abrir CORS innecesariamente. |
| Kubernetes / `deploy/k8s/*` | Se archiva, no se borra | Referencia histórica y por si en algún momento hay presupuesto/necesidad de volver a orquestar con k8s. |

**Lo que NO cambia:** arquitectura de microservicios, database-per-service, gateway Apollo Federation, modelos de datos (Postgres + Neo4j). Es lo que ya funciona y escala — tocarlo ahora sería el mismo riesgo grande que se descartó para el frontend, pero aplicado a lo que sí anda bien.

---

## 2. Diagnóstico del estado actual

**Fortalezas (no tocar):**
- 6 servicios bien separados (`gateway`, `tournaments-svc`, `teams-svc`, `auth-svc`, `inscriptions-svc`, `matchevents-svc`), database-per-service, capas controlador → servicio → repositorio.
- API REST ya documentada en SwaggerHub (`MATIASWODTKE/liga-360`). Falta el equivalente para la parte GraphQL (ver §5.2).
- Scripts de export/dump/restore ya existen (`neo4j-export-local.mjs`, `pg-dump-local.sh`, `pg-restore-prod.sh`) — son la base para armar backups automáticos, no hay que construir esto de cero.

**Brechas detectadas que hay que cerrar antes de tener clientes reales** (no son solo "nice to have", son bloqueantes para producción con datos de terceros):
1. **`ADMIN_PASSWORD=admin123` por defecto** en `.env.example` y usado como bootstrap real de `auth-svc`. Hoy es aceptable para dev/demo de cursada; con clientes reales es una vulnerabilidad directa. Rotar antes del primer cliente.
2. **`JWT_SECRET=devsecret`** — mismo problema, es el secreto compartido por todos los servicios para firmar tokens.
3. **SMTP no configurado** — sin esto no hay verificación de mail real, lo cual es raro tener apagado en un producto con usuarios reales.
4. **Neo4j Aura Free no incluye backups automáticos** (solo un snapshot manual a la vez). Con datos de clientes reales, perder el grafo de un torneo por un free tier sin backup es un riesgo serio — hay que automatizar el export existente (`neo4j-export-local.mjs`) por cron, aunque sea mientras no se pague el tier Professional.
5. `deploy/k8s/*` queda huérfano en cuanto se corta el acceso a AWS — no es una brecha del producto, pero hay que decidir explícitamente archivarlo (§7) para que no quede como fuente de verdad falsa.

---

## 3. Arquitectura objetivo, en detalle

### 3.1 Backend → Railway

Cada uno de los 6 servicios ya tiene su propio `Dockerfile` (usado hoy por los `deployment.yaml` de k8s). En Railway esto se traduce 1:1: un servicio de Railway por `Dockerfile`, sin cambios de código.

Variables de entorno por servicio (ya están relevadas en `deploy/k8s/secrets.env.example` y `.env.example`, solo hay que rotarlas y cargarlas en el panel de Railway):
- `JWT_SECRET` (compartido entre todos)
- `POSTGRES_*` / connection string de Neon
- `NEO4J_*` / connection string de Aura (solo lo necesita `tournaments-svc`)
- `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` (solo `auth-svc`, rotar el password)
- `SMTP_*` + `FRONTEND_URL` (solo `auth-svc`, `FRONTEND_URL` pasa a ser el dominio de Vercel)

**Por qué Railway y no Render como primera opción:** Render duerme los servicios free tras 15 min de inactividad (cold start de 30–60s — inaceptable si un cliente entra a la app y tarda un minuto en cargar) y borra el Postgres free a los 30 días (inaceptable con datos reales). Railway no tiene ese sleep en el plan Hobby de pago. La contra de Railway es que el free tier real es casi inusable (ver costos, §4) — pero para un producto con clientes ya se asume presupuesto pago igual, así que ese punto deja de ser relevante.

**Alternativa a evaluar si Railway no cierra en costo con 6 servicios activos:** Render en su plan pago (sin el sleep del free tier) es comparable en precio y tiene mejor track record de estabilidad para producción. Dejarlo como plan B, no como decisión abierta indefinidamente — decidir en la Fase 1 (§6) después de correr los 6 servicios una semana y ver el costo real en Railway.

### 3.2 Bases de datos

- **Neo4j → AuraDB.** Free tier: 200k nodos / 400k relaciones (verificar el número exacto en la consola de Aura al crear la instancia, hay inconsistencia entre la documentación de Neo4j y lo que muestra el producto). Sin backups automáticos en free — mitigar con cron de `neo4j-export-local.mjs` hasta pasar a Professional.
- **Postgres → Neon.** Free tier: hasta 100 proyectos, 0.5 GB por proyecto, scale-to-zero. Como hoy son 4 bases (`liga360_auth`, `liga360_teams`, `liga360_inscriptions`, `liga360_matchevents`), entra cómodo en un solo proyecto Neon con 4 databases, o 4 proyectos separados si se prefiere aislar cuotas. Alternativa: Postgres nativo de Railway, más simple operativamente (todo en un panel) pero sin el scale-to-zero de Neon.

### 3.3 Frontend → Lovable + Vercel

- Proyecto Lovable nuevo (no hay botón de "importar repo existente" en Lovable — y no hace falta, porque la decisión ya es reescribir desde cero, no migrar el código actual).
- Conectar el proyecto Lovable a un repo de GitHub propio (sync bidireccional en `main`) — **usar un repo o carpeta separada del `frontend/` actual**, no pisar el existente hasta el corte final (§6, Fase 4).
- Vercel Hobby (gratis) **prohíbe uso comercial** por sus términos de servicio — en cuanto haya un cliente pagando, se necesita **Vercel Pro ($20/mes por asiento)**. Presupuestarlo desde ahora si el objetivo es tener clientes, no dejarlo para después.
- Contrato de API para que Lovable no invente endpoints: generar un cliente tipado (`lib/api.ts`) a partir del Swagger existente + el schema GraphQL del gateway, y cargarlo en la sección "Knowledge" del proyecto Lovable. Ver §5.2.

### 3.4 Ruteo API — reemplazo exacto del nginx actual

Hoy `deploy/frontend/nginx.conf` hace de reverse proxy same-origin: el frontend llama a rutas relativas (`/api/graphql`, `/api/teams`, etc.) y nginx las reescribe hacia el DNS interno de cada servicio en k8s. Esto evita CORS por completo. Al mudarse a Vercel, se puede lograr exactamente lo mismo con `rewrites` en `vercel.json`, sin tocar el código del frontend ni abrir CORS en los servicios:

```json
{
  "rewrites": [
    { "source": "/api/graphql/:path*", "destination": "https://<gateway>.up.railway.app/graphql/:path*" },
    { "source": "/api/profiles/:path*", "destination": "https://<teams-svc>.up.railway.app/profiles/:path*" },
    { "source": "/api/participants/:path*", "destination": "https://<teams-svc>.up.railway.app/participants/:path*" },
    { "source": "/api/teams/:path*", "destination": "https://<teams-svc>.up.railway.app/teams/:path*" },
    { "source": "/api/auth/:path*", "destination": "https://<auth-svc>.up.railway.app/:path*" },
    { "source": "/api/inscriptions/:path*", "destination": "https://<inscriptions-svc>.up.railway.app/:path*" },
    { "source": "/api/matchevents/:path*", "destination": "https://<matchevents-svc>.up.railway.app/:path*" },
    { "source": "/api/matches/:path*", "destination": "https://<matchevents-svc>.up.railway.app/matches/:path*" }
  ]
}
```

Es la traducción directa, ruta por ruta, del `nginx.conf` actual (mismos rewrites de path que ya usa hoy). Reemplazar `<servicio>.up.railway.app` por el dominio público real que Railway asigna a cada servicio al desplegarlo.

---

## 4. Costos estimados (verificar en consola antes de comprometer presupuesto — precios cambian)

| Servicio | Free tier | Cuándo deja de alcanzar | Plan pago aprox. |
|---|---|---|---|
| Vercel | Hobby gratis, pero **no comercial** | Apenas haya un cliente pagando | Pro: $20/mes por asiento |
| Railway (6 servicios + gateway) | Prácticamente inusable con DB (créditos de $1/mes) | Inmediato con más de un servicio activo | Hobby desde $5/mes, pero con 6 servicios + gateway corriendo 24/7 hay que medir uso real la primera semana — estimar $20–40/mes de arranque |
| Neo4j Aura | Free: 200k nodos / 400k relaciones, sin backups | Al superar ese volumen o necesitar backups confiables | Professional (consultar precio actual en consola, ronda los $65+/mes) |
| Neon Postgres | Free: 0.5GB/proyecto, 100 CU-hora/mes | Con tráfico sostenido de varios clientes | Desde ~$19/mes |

**No asumir "gratis para siempre"** en ninguna de estas piezas si el objetivo es producto real — el presupuesto realista de arranque con clientes ronda los USD 50–100/mes entre las cuatro piezas. Confirmar con el equipo si ese rango es aceptable antes de ejecutar la Fase 1.

---

## 5. Plan de migración por fases

El objetivo de este orden es que **nunca haya un momento sin demo funcionando** — cada fase deja algo desplegado y probado antes de arrancar la siguiente.

### Fase 0 — Bases de datos nuevas
1. Crear instancia Aura (Free) y Neon (Free).
2. Migrar datos con los scripts que ya existen (`neo4j-export-local.mjs` → importar en Aura; `pg-dump-local.sh` → `pg-restore-prod.sh` apuntando a Neon).
3. Validar contra el `docker-compose.yml` local que los servicios arrancan apuntando a las bases nuevas, sin tocar nada de infra de cómputo todavía.

### Fase 1 — Backend a Railway (sin tocar frontend)
1. Desplegar los 6 `Dockerfile` existentes en Railway, apuntando a las bases de la Fase 0.
2. Rotar `JWT_SECRET` y `ADMIN_PASSWORD` (brecha §2.1–§2.2), configurar SMTP real.
3. Validar contra el **frontend actual** (el Vite que ya existe), apuntando sus `VITE_*_API_URL` a los servicios en Railway. Esto separa el riesgo: si algo falla, se sabe que es infra, no el frontend nuevo (que todavía no existe).
4. Medir costo real de Railway durante ~1 semana antes de comprometerse al plan (decide Railway vs Render, §3.1).

### Fase 2 — Congelar el contrato de API
1. Exportar el schema GraphQL compuesto del gateway (introspección de Apollo Federation) además del Swagger REST ya existente.
2. Armar el cliente tipado `lib/api.ts` a partir de ambos.
3. Cargar ese contrato en la sección "Knowledge" del proyecto Lovable — es lo que evita que la IA invente endpoints o formas de respuesta que no existen.

### Fase 3 — Frontend nuevo en Lovable
1. Proyecto Lovable nuevo, repo GitHub separado, apuntando a los mismos endpoints de Railway vía el `vercel.json` de rewrites (§3.4).
2. Iterar **módulo por módulo** contra el backend real (torneos/brackets primero, dado que es donde está la lógica de visualización más compleja — ver nota abajo; después inscripciones, equipos, etc.), no todo de una vez.
3. **Nota sobre visualización:** los componentes de layout complejo (ej. `convergingBracketLayout.ts`, el algoritmo de llaves convergentes) no los va a generar bien una IA de UI genérica. Portar ese componente a mano dentro del shell que genere Lovable, en vez de pedirle que lo reinvente.

### Fase 4 — Corte final
1. DNS del dominio real apuntando a Vercel.
2. Archivar `deploy/k8s/*` (mover a una carpeta `deploy/k8s/_archived/` o similar, con una nota de por qué se dejó de usar) — no borrar, por si en el futuro hay presupuesto para volver a orquestar con k8s.
3. Apagar el frontend viejo recién acá, no antes.

---

## 6. Checklist de producción antes del primer cliente real

- [ ] `JWT_SECRET` rotado (no `devsecret`)
- [ ] `ADMIN_PASSWORD` rotado (no `admin123`)
- [ ] SMTP real configurado (verificación de mail funcionando)
- [ ] CORS/rewrites probados end-to-end (Vercel → Railway, sin errores de origen)
- [ ] Backup automático de Neo4j corriendo por cron (aunque sea el script manual existente, agendado)
- [ ] Backup automático de Postgres (Neon tiene point-in-time recovery en free tier — confirmar retención)
- [ ] Vercel en plan Pro (no Hobby) si ya hay ingresos
- [ ] Monitoreo básico de errores en producción (ej. Sentry) — no había nada de esto mencionado en el estado actual, y con clientes reales un error silencioso es plata perdida

---

## 7. Preguntas abiertas (decisión de Bruno/Matías, no técnica)

1. **Presupuesto mensual real tolerable** — el rango estimado es USD 50–100/mes de arranque (§4). ¿Es aceptable, o hay que ajustar la infraestructura para bajarlo (por ejemplo, empezar con Postgres nativo de Railway en vez de Neon para consolidar todo en una sola factura)?
2. **Railway vs Render como decisión final** — este documento recomienda Railway, pero la Fase 1 incluye medir el costo real antes de comprometerse. ¿Confirman ese orden, o prefieren decidir la plataforma antes de migrar?
3. **Timeline de clientes** — ¿hay una fecha o hito concreto ("primer cliente piloto el DD/MM") que deba correr el plan de fases? Eso determina si las 4 fases se hacen secuenciales (más seguro) o se paralelizan (más rápido, más riesgo).
