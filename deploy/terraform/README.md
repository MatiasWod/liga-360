# Liga360 AWS Infrastructure (Student Budget)

This directory contains Terraform code to provision the AWS infrastructure required to deploy Liga360. To fit inside a $50/month budget, we use **K3s (Kubernetes) on a single EC2 Instance (`t3.large`)** rather than expensive managed clusters like EKS.

## Architecture

- **AWS VPC**: Public subnet.
- **Amazon EC2**: One `t3.large` instance (8GB RAM, 2 vCPUs) which acts as the entire Kubernetes cluster.
- **K3s**: Installed automatically via user-data script.
- **NGINX Ingress Controller**: Deployed automatically.
- **Argo CD**: Deployed automatically via user-data script.

## State Management

The `providers.tf` file is configured to use an **S3 Backend** and **DynamoDB/Lockfile**.
You must create this bucket manually in AWS or comment out the `backend "s3"` block in `providers.tf` to use local state.

## Deployment Steps

1. **Log in to AWS:**
   Make sure you have your student lab credentials ready:
   ```bash
   aws configure
   ```

2. **Initialize Terraform:**
   ```bash
   terraform init
   ```

3. **Review the Plan:**
   ```bash
   terraform plan
   ```

4. **Apply the Infrastructure:**
   ```bash
   terraform apply
   ```
   *Note: Wait about 5-10 minutes after this finishes for the EC2 instance to fully boot up and install Kubernetes and ArgoCD.*

## Post-Deployment (GitOps)

Once the EC2 is up and ArgoCD is running:

1. **SSH into your EC2:**
   ```bash
   # Run the SSH command given by "terraform output"
   ssh ubuntu@<YOUR_EC2_PUBLIC_IP>
   ```

2. **Get the ArgoCD Admin Password:**
   Run this inside the EC2 instance:
   ```bash
   sudo kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
   ```

3. **Access ArgoCD:**
   Navigate in your browser to the URL provided in the `argocd_url` terraform output (e.g. `https://<IP>:30443`). Use `admin` and the password from step 2. Accept the browser security warning.

4. **Deploy Liga360:**
   Inside the SSH session, you can clone your Git repo and apply the application:
   ```bash
   git clone https://bitbucket.org/itba/pf-2025b-liga360.git
   cd pf-2025b-liga360
    kubectl apply -f deploy/argocd/application-dev.yaml
   ```

5. **Expose the Application:**
   Point your domain or local `hosts` file to the EC2 Public IP for the `liga360.local` Ingress to work.

## Destruction

To tear everything down (and avoid AWS charges):
```bash
terraform destroy
```
