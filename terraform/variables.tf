
# terraform apply -var environment="stg"
# terraform apply -var environment="vaale-prod"
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

# terraform apply -var zipfile="../zips/build_20230819_163235.zip"
variable "zipfile" {
  description = "Zip File"
  type        = string
  default     = "../zips/build_20230819_163235.zip"
}
