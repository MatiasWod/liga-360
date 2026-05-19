## ADDED Requirements

### Requirement: Root env example documents all variables

The repository SHALL include a `.env.example` at the project root listing every environment variable used by `docker-compose.yml` and Kubernetes manifests, with safe placeholder values and brief comments.

#### Scenario: Developer copies env template

- **WHEN** a developer copies `.env.example` to `.env` for local compose
- **THEN** all required keys for postgres, neo4j, JWT, and service URLs are present with documented defaults

### Requirement: ConfigMap for non-sensitive configuration

Non-sensitive environment variables (ports, internal hostnames, `NODE_ENV`, public DB names) SHALL be supplied via a ConfigMap `liga360-config` referenced by application Deployments.

#### Scenario: Config change without secret rotation

- **WHEN** an operator updates a non-sensitive value in ConfigMap and rolls out Deployments
- **THEN** pods receive the updated value without modifying Secret resources

### Requirement: Secret for sensitive values

Sensitive values (`JWT_SECRET`, `POSTGRES_PASSWORD`, `NEO4J_PASSWORD`, database credentials) SHALL be loaded from a Kubernetes Secret `liga360-secrets`, not plain text in Deployments.

#### Scenario: Secret not committed to git

- **WHEN** the repository is cloned
- **THEN** no file under version control contains production secret values; only `secrets.env.example` or README instructions exist

### Requirement: Environment parity with docker-compose

Kubernetes env vars for each microservice SHALL match the semantic names and internal URLs used in `docker-compose.yml` (e.g. `POSTGRES_URL` pointing at `postgres` service, `NEO4J_URI` at `bolt://neo4j:7687`, `TOURNAMENTS_SUBGRAPH_URL` at gateway-internal URL).

#### Scenario: Inscriptions service reaches tournaments GraphQL

- **WHEN** inscriptions-svc pod starts with manifest-provided env
- **THEN** `TOURNAMENTS_GRAPHQL_URL` resolves to the in-cluster gateway GraphQL endpoint

### Requirement: Secrets setup documentation

`k8s/README.md` SHALL document how to create `liga360-secrets` from an env file using `kubectl create secret generic --from-env-file`.

#### Scenario: First-time cluster bootstrap

- **WHEN** an operator follows README secret steps before applying manifests
- **THEN** Deployments mount required keys and pods start without missing env errors
