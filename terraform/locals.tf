locals {
  timestamp             = formatdate("YYMMDDhhmmss", timestamp())
  project_name          = "vaale_app"
  node_version          = "nodejs18.x"
  dynamo_billing_mode   = "PAY_PER_REQUEST"
  dynamo_hight_capacity = null
  dynamo_low_capacity   = null
  #dynamo_billing_mode = "PROVISIONED"
  #dynamo_hight_capacity = 20
  #dynamo_low_capacity   = 10
}
