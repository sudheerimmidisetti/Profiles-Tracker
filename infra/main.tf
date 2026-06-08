terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.36"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state in S3 — create bucket first, then uncomment
  # backend "s3" {
  #   bucket         = "cptrack-terraform-state"
  #   key            = "production/terraform.tfstate"
  #   region         = "ap-south-1"
  #   encrypt        = true
  #   dynamodb_table = "cptrack-terraform-locks"  # for state locking
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "CPTrack"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Repo        = "github.com/PrasannaReddy0583/profiles_tracker"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
