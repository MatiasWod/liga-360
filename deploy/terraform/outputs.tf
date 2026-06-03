
output "public_ip" {
  value = data.aws_eip.k3s_eip.public_ip
}

output "elastic_ip" {
  description = "La IP Elástica pública asociada al balanceador"
  value       = data.aws_eip.k3s_eip.public_ip
}


output "argocd_url" {
  description = "URL para acceder a ArgoCD"
  value       = "https://${data.aws_eip.k3s_eip.public_ip}:30443"
}

output "app_url" {
  value = "https://app.${var.domain_name}" # Esto sigue igual, asumiendo que tu DNS apunta a la EIP
}
