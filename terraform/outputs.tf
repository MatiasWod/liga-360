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
