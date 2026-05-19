## ADDED Requirements

### Requirement: Frontend nginx proxies API paths

The frontend container nginx configuration SHALL proxy paths `/api/graphql`, `/api/teams`, `/api/auth`, and `/api/inscriptions` to the corresponding in-cluster Services, preserving the same path rewriting behavior as `vite.config.ts` in development.

#### Scenario: Browser calls relative API from frontend Ingress

- **WHEN** a user loads the SPA and the app requests `GET /api/teams/...`
- **THEN** nginx forwards the request to `teams-svc` with the path rewrite that strips the `/api/teams` prefix

### Requirement: GraphQL proxy targets gateway

Requests to `/api/graphql` SHALL be proxied to the `gateway` service `/graphql` endpoint.

#### Scenario: Tournament query via frontend URL

- **WHEN** the SPA posts to `/api/graphql`
- **THEN** the request reaches Apollo Gateway on port 4000 at path `/graphql`

### Requirement: Ingress exposes the stack externally

Overlay `k8s/overlays/dev` SHALL include an Ingress resource routing external HTTP traffic to the `frontend` Service (port 80).

#### Scenario: Access via documented host

- **WHEN** an operator maps host `liga360.local` to the cluster ingress IP and opens `http://liga360.local`
- **THEN** the Liga360 UI loads and API calls via relative `/api/*` paths succeed

### Requirement: Internal service DNS only for east-west traffic

Microservices SHALL communicate using Kubernetes Service names (e.g. `http://gateway:4000/graphql`) without hardcoding pod IPs or NodePorts for inter-service calls.

#### Scenario: Gateway calls tournaments subgraph

- **WHEN** gateway resolves `TOURNAMENTS_SUBGRAPH_URL`
- **THEN** the URL uses the `tournaments-svc` Service hostname on port 4001

### Requirement: Networking documentation

`k8s/README.md` SHALL describe how to obtain the Ingress address, configure local DNS (`/etc/hosts` or equivalent), and optional NodePort fallback if Ingress controller is unavailable.

#### Scenario: Developer without Ingress controller

- **WHEN** README NodePort section is followed
- **THEN** the operator can reach frontend without an Ingress resource
