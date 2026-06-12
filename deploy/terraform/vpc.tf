data "aws_availability_zones" "available" {}

locals {
  name   = "liga360-vpc-${var.environment}"
  region = var.aws_region
  azs    = slice(data.aws_availability_zones.available.names, 0, 2)
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = local.name
  cidr = var.vpc_cidr

  azs             = local.azs
  public_subnets  = [for k, v in local.azs : cidrsubnet(var.vpc_cidr, 4, k)]
  private_subnets = [for k, v in local.azs : cidrsubnet(var.vpc_cidr, 4, k + 2)] # 1. Agregamos subredes privadas

  # 2. Activamos NAT Gateway para que la instancia privada tenga salida a internet (ArgoCD Pull, descargas, etc.)
  enable_nat_gateway   = true
  single_nat_gateway   = true # Mantiene el presupuesto bajo en DEV
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Environment = var.environment
  }
}



