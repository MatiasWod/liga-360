data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_security_group" "k3s_sg" {
  name        = "liga360-k3s-sg"
  description = "Security group for K3s single node"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  ingress {
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Kube API (Optional, restrict this in production)"
  }

  ingress {
    description = "ArgoCD UI NodePort"
    from_port   = 30443
    to_port     = 30443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Frontend NodePort"
    from_port   = 30080
    to_port     = 30080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "k3s_node" {
  ami                  = data.aws_ami.ubuntu.id
  instance_type        = var.instance_type
  key_name             = "vockey"
  iam_instance_profile = "LabInstanceProfile"

  # --- CAMBIOS DE RED APLICADOS ACÁ ---
  subnet_id                   = module.vpc.private_subnets[0]
  vpc_security_group_ids      = [aws_security_group.k3s_sg.id]
  associate_public_ip_address = false

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  # --- TU SCRIPT ORIGINAL INTACTO ---
  user_data = <<-EOF
#!/bin/bash
set -e

# Wait for network
sleep 30

export INSTALL_K3S_EXEC="--disable traefik"
curl -sfL https://get.k3s.io | sh -

sleep 15
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/baremetal/deploy.yaml

sleep 20
kubectl patch deployment ingress-nginx-controller -n ingress-nginx -p '{"spec": {"template": {"spec": {"hostNetwork": true}}}}' || true

kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml

kubectl wait --for=condition=Available deployment/cert-manager -n cert-manager --timeout=300s

kubectl wait --for=condition=Available deployment/cert-manager-webhook -n cert-manager --timeout=300s

kubectl wait --for=condition=Available deployment/cert-manager-cainjector -n cert-manager --timeout=300s


kubectl create namespace argocd
kubectl apply -n argocd --server-side -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
bash get_helm.sh

helm repo add external-secrets https://charts.external-secrets.io
helm repo update
helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace --set installCRDs=true

sleep 15
kubectl wait --for condition=established --timeout=60s crd/clustersecretstores.external-secrets.io
kubectl wait --for condition=established --timeout=60s crd/externalsecrets.external-secrets.io
kubectl wait --for=condition=Available deployment/external-secrets -n external-secrets --timeout=120s
kubectl wait --for=condition=Available deployment/external-secrets-webhook -n external-secrets --timeout=120s
kubectl wait --for=condition=Available deployment/external-secrets-cert-controller -n external-secrets --timeout=120s

kubectl wait --for=condition=Available deployment/argocd-server -n argocd --timeout=300s
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "NodePort", "ports": [{"port": 443, "nodePort": 30443, "targetPort": 8080}]}}'

cat << 'EOF_CSS' > /tmp/cluster-secret-store.yaml
apiVersion: external-secrets.io/v1
kind: ClusterSecretStore
metadata:
  name: aws-secrets
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
EOF_CSS

cat << 'EOF_ES' > /tmp/argocd-external-secret.yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: argocd-repo-creds
  namespace: argocd
spec:
  refreshInterval: "1h"
  secretStoreRef:
    name: aws-secrets
    kind: ClusterSecretStore
  target:
    name: liga360-git-repo
    template:
      metadata:
        labels:
          argocd.argoproj.io/secret-type: repository
      data:
        type: "git"
        url: "https://bitbucket.org/itba/pf-2025b-liga360.git"
        username: "{{ .username }}"
        password: "{{ .password }}"
    creationPolicy: Owner
  data:
    - secretKey: username
      remoteRef:
        key: argocd-repo-credentials
        property: username
    - secretKey: password
      remoteRef:
        key: argocd-repo-credentials
        property: password
EOF_ES

cat << 'EOF_APP' > /tmp/argocd-bootstrap.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: liga360-bootstrap
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://bitbucket.org/itba/pf-2025b-liga360.git
    targetRevision: main
    path: deploy/argocd/apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
EOF_APP

cat << 'EOF_ISSUER' > /tmp/cluster-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    email: mwodtke@itba.edu.ar
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF_ISSUER

# Bucle con "if" para evadir el corte de set -e
for i in $(seq 1 10); do
  echo "Bootstrap attempt $i/10..."
  rm -rf ~/.kube/cache 2>/dev/null || true

  if kubectl apply -f /tmp/cluster-issuer.yaml && \
      kubectl apply --server-side -f /tmp/cluster-secret-store.yaml && \
     kubectl apply --server-side -f /tmp/argocd-external-secret.yaml && \
     kubectl apply --server-side -f /tmp/argocd-bootstrap.yaml; then
    echo "Bootstrap applied successfully!!"
    break
  fi

  echo "Attempt $i failed, waiting 15s..."
  sleep 15
done

mkdir -p /home/ubuntu/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
chown -R ubuntu:ubuntu /home/ubuntu/.kube
EOF

  tags = {
    Name = "liga360-k3s-node"
  }
}

# ==============================================================================
# NUEVOS RECURSOS: ELIP Y NETWORK LOAD BALANCER (NLB)
# ==============================================================================


variable "EXISTING_EIP" {
  description = "La Elastic IP estática a utilizar"
  type        = string
}


data "aws_eip" "k3s_eip" {
  public_ip = var.EXISTING_EIP
}

resource "aws_lb" "k3s_nlb" {
  name               = "liga360-k3s-nlb"
  internal           = false
  load_balancer_type = "network"

  subnet_mapping {
    subnet_id     = module.vpc.public_subnets[0]
    allocation_id = data.aws_eip.k3s_eip.id
  }

  tags = {
    Name = "liga360-k3s-nlb"
  }
}

# --- TARGET GROUPS ---

resource "aws_lb_target_group" "tg_80" {
  name        = "liga360-tg-80"
  port        = 80
  protocol    = "TCP"
  vpc_id      = module.vpc.vpc_id
  target_type = "instance"
}

resource "aws_lb_target_group" "tg_443" {
  name        = "liga360-tg-443"
  port        = 443
  protocol    = "TCP"
  vpc_id      = module.vpc.vpc_id
  target_type = "instance"
}

resource "aws_lb_target_group" "tg_6443" {
  name        = "liga360-tg-6443"
  port        = 6443
  protocol    = "TCP"
  vpc_id      = module.vpc.vpc_id
  target_type = "instance"
}

resource "aws_lb_target_group" "tg_30443" {
  name        = "liga360-tg-30443"
  port        = 30443
  protocol    = "TCP"
  vpc_id      = module.vpc.vpc_id
  target_type = "instance"
}

# -- LISTENERS --

resource "aws_lb_listener" "listener_80" {
  load_balancer_arn = aws_lb.k3s_nlb.arn
  port              = "80"
  protocol          = "TCP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_80.arn
  }
}

resource "aws_lb_listener" "listener_443" {
  load_balancer_arn = aws_lb.k3s_nlb.arn
  port              = "443"
  protocol          = "TCP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_443.arn
  }
}

resource "aws_lb_listener" "listener_6443" {
  load_balancer_arn = aws_lb.k3s_nlb.arn
  port              = "6443"
  protocol          = "TCP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_6443.arn
  }
}

resource "aws_lb_listener" "listener_30443" {
  load_balancer_arn = aws_lb.k3s_nlb.arn
  port              = "30443"
  protocol          = "TCP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg_30443.arn
  }
}

# --- ATTACHMENTS (Vinculan el balanceador a la instancia privada) ---

resource "aws_lb_target_group_attachment" "attach_80" {
  target_group_arn = aws_lb_target_group.tg_80.arn
  target_id        = aws_instance.k3s_node.id
}

resource "aws_lb_target_group_attachment" "attach_443" {
  target_group_arn = aws_lb_target_group.tg_443.arn
  target_id        = aws_instance.k3s_node.id
}

resource "aws_lb_target_group_attachment" "attach_6443" {
  target_group_arn = aws_lb_target_group.tg_6443.arn
  target_id        = aws_instance.k3s_node.id
}

resource "aws_lb_target_group_attachment" "attach_30443" {
  target_group_arn = aws_lb_target_group.tg_30443.arn
  target_id        = aws_instance.k3s_node.id
}

