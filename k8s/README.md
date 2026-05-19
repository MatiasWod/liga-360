# Liga360 — Kubernetes

Manifiestos [Kustomize](https://kustomize.io/) para desplegar el stack completo de Liga360 en un clúster Kubernetes (kind, minikube o remoto).

## Requisitos

- `kubectl` 1.28+
- Clúster local ([kind](https://kind.sigs.k8s.io/) o [minikube](https://minikube.sigs.k8s.io/)) con al menos **6 GB RAM** libres (Neo4j + PostgreSQL + 6 apps)
- [Docker](https://www.docker.com/) para construir imágenes
- Ingress controller (p. ej. `ingress-nginx` en kind/minikube)

## Estructura

```
k8s/
├── base/                 # Namespace, ConfigMap, StatefulSets, Deployments, Services
├── overlays/dev/         # Ingress liga360.local, tags :local, imagePullPolicy
├── secrets.env.example   # Plantilla de secretos (no commitear secrets.env)
└── README.md
```

## 1. Construir imágenes locales

Desde la raíz del repositorio:

```bash
docker compose build
```

Etiquetar para Kustomize overlay `dev` (`liga360/<service>:local`):

```bash
for svc in frontend gateway auth-svc teams-svc tournaments-svc inscriptions-svc; do
  docker tag "pf-2025b-liga360-${svc}-1" "liga360/${svc}:local" 2>/dev/null || \
  docker tag "liga360-${svc}" "liga360/${svc}:local" 2>/dev/null || \
  docker tag "$(docker compose images -q ${svc} 2>/dev/null | head -1 | xargs -I{} docker inspect --format='{{.RepoTags}}' {} 2>/dev/null | tr -d '[]')" "liga360/${svc}:local"
done
```

En Windows/PowerShell, etiquetá manualmente cada imagen que produzca `docker compose build`, por ejemplo:

```powershell
docker tag pf-2025b-liga360-frontend-1 liga360/frontend:local
docker tag pf-2025b-liga360-gateway-1 liga360/gateway:local
# ... auth-svc, teams-svc, tournaments-svc, inscriptions-svc
```

Para **kind**, cargá las imágenes al nodo:

```bash
kind load docker-image liga360/frontend:local
kind load docker-image liga360/gateway:local
# ... resto de servicios
```

## 2. Crear secretos

```bash
cp k8s/secrets.env.example k8s/secrets.env
# Editar k8s/secrets.env con valores seguros en entornos reales

kubectl create namespace liga360 --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic liga360-secrets \
  --namespace liga360 \
  --from-env-file=k8s/secrets.env \
  --dry-run=client -o yaml | kubectl apply -f -
```

Claves requeridas: `JWT_SECRET`, `POSTGRES_PASSWORD`, `POSTGRES_URL`, `NEO4J_PASSWORD`, `NEO4J_AUTH`.

## 3. Aplicar manifiestos

Vista previa:

```bash
kubectl kustomize k8s/overlays/dev
```

Desplegar:

```bash
kubectl apply -k k8s/overlays/dev
```

Esperar pods listos:

```bash
kubectl -n liga360 get pods -w
```

## 4. Acceder a la aplicación

### Con Ingress (recomendado)

1. Obtener IP del Ingress:

   ```bash
   kubectl -n liga360 get ingress liga360
   ```

2. Añadir a `C:\Windows\System32\drivers\etc\hosts` (o `/etc/hosts`):

   ```
   <INGRESS_IP>  liga360.local
   ```

3. Abrir `http://liga360.local`

### Sin Ingress (NodePort)

```bash
kubectl -n liga360 expose deployment frontend --type=NodePort --port=80 --name=frontend-nodeport
kubectl -n liga360 get svc frontend-nodeport
```

Abrí `http://localhost:<nodePort>` (minikube: `minikube service frontend-nodeport -n liga360 --url`).

## 5. Smoke / health checks

```bash
kubectl -n liga360 port-forward svc/gateway 4000:4000 &
curl -s http://localhost:4000/health

kubectl -n liga360 port-forward svc/auth-svc 4003:4003 &
curl -s http://localhost:4003/health
```

La UI debe cargar en `http://liga360.local` y las llamadas `/api/*` deben proxearse vía nginx del pod `frontend`.

## Registry remoto (Bitbucket CI)

Las imágenes se publican como `$DOCKER_USER/liga360-<service>:$BITBUCKET_COMMIT`. Creá un overlay (p. ej. `k8s/overlays/prod/`) que reemplace en `images:`:

```yaml
images:
  - name: liga360/frontend
    newName: your-user/liga360-frontend
    newTag: <commit-sha>
```

Si el registry es privado, creá `imagePullSecrets` y referenciálos en los Deployments.

## Troubleshooting

### Neo4j en CrashLoopBackOff (`PORT.7687.TCP.PORT`)

Kubernetes inyecta variables de servicio que Neo4j interpreta como config. El StatefulSet usa `enableServiceLinks: false` para evitarlo. Si recreás el pod: `kubectl -n liga360 delete pod neo4j-0`.

### Deployments sin imagen tras `kustomize build`

No uses un strategic-merge patch genérico sobre `containers` en Deployments (puede borrar `image`). El `imagePullPolicy: IfNotPresent` está en los manifiestos base.

## Rollback

```bash
kubectl delete -k k8s/overlays/dev
# o
kubectl delete namespace liga360
```

## Variables de entorno

Ver `.env.example` (compose) y `k8s/secrets.env.example` (K8s). La configuración no sensible está en ConfigMap `liga360-config`.
