terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  required_version = ">= 1.0.6"
}

provider "aws" {
  region = var.region
}

module "secrets-manager" {
  source  = "terraform-aws-modules/secrets-manager/aws"
  version = "1.1.1"
}