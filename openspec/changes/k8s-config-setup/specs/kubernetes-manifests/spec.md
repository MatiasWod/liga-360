## ADDED Requirements

### Requirement: Namespace liga360

The deployment SHALL create a Kubernetes namespace named `liga360` that contains all application resources.

#### Scenario: Apply base kustomization

- **WHEN** an operator runs `kubectl apply -k k8s/base` or `kubectl apply -k k8s/overlays/dev`
- **THEN** namespace `liga360` exists and all Liga360 resources are scoped to it

### Requirement: Application Deployments mirror docker-compose services

The repository SHALL provide a Deployment and ClusterIP Service for each runnable component in `docker-compose.yml`: `frontend`, `gateway`, `auth-svc`, `teams-svc`, `tournaments-svc`, `inscriptions-svc`, `postgres`, and `neo4j`.

#### Scenario: All services are discoverable in-cluster

- **WHEN** the base manifests are applied successfully
- **THEN** each component has a Service DNS name `<service-name>` resolvable as `<service-name>.liga360.svc.cluster.local` on the declared port

### Requirement: Health probes on HTTP microservices

Each Node microservice Deployment (ports 4000–4004) SHALL define `livenessProbe` and `readinessProbe` HTTP GET checks against `/health` on the container port.

#### Scenario: Unready pod is removed from Service endpoints

- **WHEN** a microservice fails its readiness probe
- **THEN** Kubernetes does not route traffic to that pod until the probe succeeds

### Requirement: Database workloads use persistent storage

PostgreSQL and Neo4j SHALL be deployed as StatefulSets (or equivalent) with PersistentVolumeClaims so data survives pod restarts in dev clusters.

#### Scenario: Pod restart retains data

- **WHEN** a postgres or neo4j pod is deleted and recreated
- **THEN** the new pod mounts the same PVC and retains previously written data

### Requirement: Gateway depends on tournaments subgraph

The `gateway` Deployment SHALL not be considered ready until `tournaments-svc` passes readiness, matching compose `depends_on` behavior.

#### Scenario: Gateway starts after tournaments-svc

- **WHEN** tournaments-svc is not ready
- **THEN** gateway pods remain NotReady until tournaments-svc endpoints are available

### Requirement: Kustomize image substitution

Base kustomization SHALL declare an `images:` section (or overlay patch) so operators can replace placeholder image names with registry/tag values without editing raw Deployment YAML.

#### Scenario: Custom registry tag applied

- **WHEN** an operator sets image replacements in overlay `dev` or via `kustomize edit set image`
- **THEN** rendered manifests reference the substituted image repository and tag
