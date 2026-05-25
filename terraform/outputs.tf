output "k3s_public_ip" {
  description = "The public IP address of the K3s node"
  value       = aws_instance.k3s_node.public_ip
}

output "ssh_command" {
  description = "Command to SSH into the K3s node"
  value       = "ssh ubuntu@${aws_instance.k3s_node.public_ip}"
}

output "argocd_url" {
  description = "URL to access ArgoCD (Accept the self-signed certificate)"
  value       = "https://${aws_instance.k3s_node.public_ip}:30443"
}

output "argocd_password_command" {
  description = "Command to retrieve the ArgoCD admin password (Run this inside the server!)"
  value       = "sudo kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
}

output "public_ip" {
  value = aws_eip.k3s_eip.public_ip
}

output "app_url" {
  value = "https://app.${var.domain_name}"
}

output "nlb_dns_name" {
  description = "El DNS público del Network Load Balancer"
  value       = aws_lb.k3s_nlb.dns_name
}

output "elastic_ip" {
  description = "La IP Elástica pública asociada al balanceador"
  value       = aws_eip.k3s_eip.public_ip
}

output "vpc_id" {
  description = "El ID de la VPC de desarrollo"
  value       = module.vpc.vpc_id
}

output "private_instance_id" {
  description = "El ID de tu nodo K3s (útil para conectarte por AWS Systems Manager)"
  value       = aws_instance.k3s_node.id
}