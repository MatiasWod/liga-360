# Liga 360 — Project Context

## 1. Objetivo del sistema

Liga 360 es una plataforma web orientada a la **gestión integral de torneos deportivos**, permitiendo:

- Crear torneos altamente configurables (ligas, copas, formatos mixtos)
- Automatizar generación de fixtures, fases y clasificaciones
- Centralizar estadísticas y datos históricos
- Unificar la interacción entre organizadores, equipos y visualizadores

El objetivo principal es **reemplazar procesos manuales y herramientas fragmentadas** por un sistema flexible, escalable y automatizado.

---

## 2. Problema que se busca resolver

Las soluciones actuales presentan limitaciones:

- Baja flexibilidad en formatos de torneo
- Falta de persistencia o gestión en tiempo real
- Mala experiencia de usuario
- Falta de estadísticas históricas globales

Resultado:
- Uso de planillas manuales
- Procesos propensos a errores
- Baja eficiencia operativa

---

## 3. Usuarios del sistema

### 3.1 Entidad organizadora (usuario principal)
- Crea torneos
- Define reglas, fases y formatos
- Administra resultados y cronogramas

### 3.2 Equipos / participantes
- Se registran
- Se inscriben en torneos
- Consultan partidos y estadísticas

### 3.3 Visualizador (usuario público)
- Consulta torneos
- Ve fixtures, resultados y posiciones
- No requiere autenticación

---

## 4. Conceptos clave del dominio

### Torneo
Entidad principal que agrupa:
- fases
- equipos
- reglas
- estructura de competencia

### Competición vs Etapa
⚠️ Concepto crítico (ya generó confusión en usuarios)

- **Competición**: estructura macro (ej: División A, Copa)
- **Etapa/Fase**: instancia dentro de una competición (ej: grupos, playoffs)

### Fixture
Generación automática de enfrentamientos entre equipos.

### Progresión
Relación entre etapas o torneos:
- clasificación
- ascenso / descenso
- pasaje entre fases

### Ponderación
Sistema para balancear equipos:
- automático (histórico / performance)
- manual

---

## 5. Alcance funcional (resumen por fases)

### Fase II — MVP
- Creación de torneos
- Definición de formatos
- Generación de fixtures
- Inscripción de equipos
- Visualización básica

### Fase III
- Gestión de torneos en curso
- Carga de resultados
- Tablas de posiciones
- Estadísticas básicas

### Fase IV
- Relaciones entre torneos
- Ascensos / descensos
- Ponderación de equipos
- Reglas avanzadas

### Fase V
- Optimización
- Testing completo
- Escalabilidad
- Usabilidad

---

## 6. Arquitectura del sistema

### Frontend
- React / Next.js (SPA)
- Consumo de APIs async

### Backend
- Node.js
- Arquitectura modular (no monolítica)

### APIs
- REST → operaciones simples
- GraphQL → queries complejas y agregadas

### Bases de datos
- PostgreSQL → entidades (usuarios, equipos)
- Neo4j → relaciones complejas (fixtures, progresiones)

### Infraestructura
- Docker (contenedores)
- Cloud (escalabilidad y disponibilidad)

---

## 7. Decisiones técnicas clave

- Separación REST vs GraphQL para optimizar performance
- Uso de base de grafos para modelar relaciones dinámicas
- Arquitectura desacoplada para permitir evolución independiente
- SPA para mejorar experiencia de usuario

---

## 8. Reglas de negocio importantes

- Un torneo puede tener múltiples competiciones
- Las competiciones pueden estar vinculadas entre sí
- Los equipos pueden participar en múltiples torneos simultáneamente
- Los torneos pueden ser públicos o privados
- FIRST setup define toda la estructura (alta importancia)

---

## 9. Constraints y riesgos conocidos

- Complejidad alta en modelado de relaciones (Neo4j)
- Posible confusión conceptual (competición vs fase)
- Escalabilidad de queries complejas (GraphQL)
- Consistencia entre múltiples fuentes de datos

---

## 10. Métricas de éxito

- Tiempo de creación de torneo ↓
- Errores manuales ↓
- Adopción por organizadores ↑
- Tiempo de carga de datos ↓
- Retención de usuarios ↑

---

## 11. Casos de uso críticos

### Caso 1
Crear torneo tipo mundial:
- grupos + eliminación directa

### Caso 2
Sistema complejo:
- múltiples divisiones
- ascensos / descensos
- copa integrada

### Caso 3
Visualización pública:
- lista de torneos

### Caso 4
Detalle de torneo:
- posiciones
- equipos
- estadísticas

---

## 12. Qué NO es el sistema

Para evitar malas decisiones:

- No es un sistema rígido de torneos
- No está limitado a un deporte
- No es solo un generador de fixtures
- No es un CRUD simple

Es un **motor flexible de modelado de competencias deportivas**

---

## 13. Principio de abstracción y diseño limpio

El sistema debe mantener **un nivel de abstracción claro y consistente en todas sus capas**.

### Objetivo

Evitar que la lógica de negocio quede acoplada a detalles de implementación, facilitando:

- mantenibilidad
- testeo
- escalabilidad
- evolución del sistema

---

### Reglas clave

- La **lógica de negocio no debe depender directamente de:**
  - bases de datos (Neo4j / PostgreSQL)
  - frameworks (Express, Apollo, etc.)
  - detalles de infraestructura

- Separar claramente:
  - **qué hace el sistema** (dominio / reglas de negocio)
  - **cómo se implementa** (persistencia, APIs, librerías)

---

### Ejemplos

#### ❌ Incorrecto
- Resolver progresiones de torneo directamente en queries de base de datos
- Mezclar lógica de generación de fixtures dentro de resolvers GraphQL

#### ✅ Correcto
- Implementar lógica de fixtures en servicios de dominio independientes
- Mantener los resolvers/controladores como capa de orquestación

---

### Capas sugeridas

- **Dominio** → reglas de negocio puras
- **Aplicación** → orquestación de casos de uso
- **Infraestructura** → DB, APIs externas, frameworks

---

### Principio rector

> La lógica de negocio debe poder existir y testearse sin depender de la tecnología utilizada.

---

## 14. Stack del proyecto

El sistema está construido sobre una arquitectura de microservicios con separación clara de responsabilidades.

### Frontend
- React + Vite + Tailwind (`src/`)
- Aplicación SPA que consume APIs del backend

---

### Backend

#### Gateway
- Apollo Gateway  
- URL: http://localhost:4000  
- Punto de entrada único y composición de servicios GraphQL  

---

#### Microservicios

- tournaments-svc  
  - GraphQL + Neo4j  
  - URL: http://localhost:4001  
  - Maneja torneos, fases, fixtures y progresiones  

- teams-svc  
  - REST + PostgreSQL  
  - URL: http://localhost:4002  
  - Maneja equipos  

- auth-svc  
  - REST + PostgreSQL  
  - URL: http://localhost:4003  
  - Maneja autenticación y usuarios  

- inscriptions-svc  
  - REST + PostgreSQL  
  - URL: http://localhost:4004  
  - Maneja inscripciones e invitaciones  

---

### Bases de datos

- Neo4j  
  - Puertos: 7474 / 7687  
  - Uso: relaciones complejas  

- PostgreSQL  
  - Host: localhost  
  - Puerto: 55432  
  - DB: liga360  
  - Uso: entidades estructuradas  

---

### Principio de uso del stack

- GraphQL → relaciones complejas y agregaciones  
- REST → operaciones simples  
- Neo4j → relaciones dinámicas  
- PostgreSQL → datos estructurados  

---

## 15. Errores comunes a evitar

- Confundir competición con fase
- Modelar relaciones complejas en Postgres en vez de Neo4j
- Duplicar lógica de generación de fixtures
- No validar consistencia entre fases relacionadas
- Hardcodear formatos de torneo

---

## 16. Reglas de modelado

- Toda relación entre fases debe ser explícita
- Las progresiones deben ser trazables
- No asumir estructuras fijas
- Todo debe ser configurable

---

## 17. Prioridades del sistema

1. Correctitud del modelo de torneo
2. Flexibilidad
3. Escalabilidad
4. UX

Nunca sacrificar (1) por velocidad