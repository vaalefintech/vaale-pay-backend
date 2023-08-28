
# terraform apply -var environment="dev"
# terraform apply -var environment="pro"
variable "environment" {
  description = "Environment"
  type        = string
  default     = "dev"
}

variable "region" {
  description = "Region"
  type        = string
  default     = "us-east-1"
}

variable "account" {
  description = "Account number"
  type        = string
  default     = "060199919132"
}

# terraform apply -var zipfile="../zips/build_20230828_091000.zip"
variable "zipfile" {
  description = "Zip File"
  type        = string
  default     = "../zips/build_20230828_091000.zip"
}
