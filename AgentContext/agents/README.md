# Sistema de Subagentes — Liga360

Este directorio contiene el contexto de cada servicio y módulo del proyecto, los templates para el pipeline de implementación y las reuniones de revisión.

---

## 1. Generar los subagentes

Si los archivos `agent.md` no existen o están desactualizados, seguí estos pasos:

### Opción A: Prompt automático (recomendado)

1. Abrí una sesión nueva de **OpenCode** en la raíz del proyecto
2. Copiá **todo** el contenido de `AgentContext/agents/templates/opencode-prompt.md`
3. Pegalo como primer mensaje en OpenCode
4. Esperá a que termine

OpenCode va a escanear el proyecto y generar automáticamente:
- Un `agent.md` por cada servicio backend en `services/`
- Un `agent.md` por cada módulo frontend en `frontend/modules/`
- Un `agent.md` por cada componente compartido en `frontend/components/`
- Un `agent.md` para la capa de servicios API
- Una reunión "State of the Art" cruzando todos los agentes

### Opción B: Regenerar solo lo que falta

Si se agregó un servicio o módulo nuevo, pedile a OpenCode:

> "Generá un agent.md para `<nombre-del-servicio-o-modulo>` siguiendo el formato de los que ya existen en `AgentContext/agents/`."

---

## 2. Pipeline de implementación

Cada tarea sigue un flujo de **5 fases** entre **Claude** (planificación + review) y **OpenCode** (implementación con subagentes).

```
┌─────────────┬──────────────┬──────────────┬───────────┬──────────────────┐
│  FASE 1     │   FASE 2     │   FASE 3     │  FASE 4   │    FASE 5        │
│  PLANNING   │ IMPLMENT.    │   REVIEW     │  FIXES    │  FINAL MEETING   │
│             │              │              │           │                  │
│  Claude     │  OpenCode    │   Claude     │ OpenCode  │  OpenCode        │
│             │ (subagents)  │              │           │  (subagents)     │
└─────────────┴──────────────┴──────────────┴───────────┴──────────────────┘
```

### Fase 1 — Planning (Claude)

1. Abrí Claude
2. Copiá el contenido de `templates/claude-planning-prompt.md`
3. Reemplazá `<DESCRIBIR LA TAREA AQUÍ>` con la tarea concreta
4. Claude genera el plan en `AgentContext/plans/plan-<id>.md`

### Fase 2 — Implementación (OpenCode + subagentes)

1. Abrí OpenCode
2. Pasale el plan generado en la Fase 1
3. OpenCode lee los `agent.md` relevantes e implementa
4. Corre `npm run test:ci`

### Fase 3 — Review (Claude)

1. Abrí Claude
2. Copiá el contenido de `templates/claude-review-prompt.md`
3. Reemplazá `<id>` con el ID del plan
4. Claude genera el review en `AgentContext/reviews/review-<id>.md`

### Fase 4 — Fixes (OpenCode)

1. Pasale el review a OpenCode
2. OpenCode aplica los fixes
3. Corre `npm run test:ci` nuevamente

### Fase 5 — Final Meeting (OpenCode)

1. Pedile a OpenCode:
   > "Leé los agent.md de los servicios y módulos que se tocaron en el plan-<id>. Generá una final meeting en `AgentContext/agents/meetings/final-review-<id>.md` validando que el plan se cumplió."
2. **Solo después de esta reunión se hace commit**

---

## 3. Estructura

```
AgentContext/
├── context.md                          # Contexto completo del proyecto
├── rules.md                            # Reglas de comunicación y estilo
├── plans/                              # Plans generados por Claude
│   └── plan-<id>.md
├── reviews/                            # Reviews generados por Claude
│   └── review-<id>.md
└── agents/
    ├── README.md                       # Este archivo
    ├── templates/
    │   ├── opencode-prompt.md          # Prompt para generar subagentes
    │   ├── claude-planning-prompt.md   # Prompt para Fase 1
    │   └── claude-review-prompt.md     # Prompt para Fase 3
    ├── services/                       # Agentes de backend
    │   └── <nombre>/agent.md
    ├── frontend/                       # Agentes de frontend
    │   ├── modules/<nombre>/agent.md
    │   ├── components/<nombre>/agent.md
    │   └── services/agent.md
    └── meetings/                       # Reuniones generadas
        ├── state-of-the-art-<fecha>.md
        └── final-review-<id>.md
```

---

## 4. Resumen rápido

| Qué querés hacer | Archivo | Herramienta |
|------------------|---------|-------------|
| Generar subagentes | `templates/opencode-prompt.md` | OpenCode |
| Crear un plan | `templates/claude-planning-prompt.md` | Claude |
| Implementar | plan generado | OpenCode |
| Revisar implementación | `templates/claude-review-prompt.md` | Claude |
| Aplicar fixes | review generado | OpenCode |
| Final meeting (antes de commit) | — | OpenCode |
| State of the Art (análisis general) | — | OpenCode |
