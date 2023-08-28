
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

variable "account" {
  description = "Account number"
  type        = string
  default     = "060199919132"
}

# terraform apply -var zipfile="../zips/build_20230827_191136.zip"
variable "zipfile" {
  description = "Zip File"
  type        = string
  default     = "../zips/build_20230827_191136.zip"
}
