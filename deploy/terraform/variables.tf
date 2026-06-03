variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "instance_type" {
  description = "Instance type for the K3s node"
  type        = string
  default     = "t3.large"
}

variable "key_name" {
  description = "Optional SSH key pair name in AWS to connect to the EC2 instance"
  type        = string
  default     = ""
}

variable "domain_name" {
  type    = string
  default = "liga360.com"
}
