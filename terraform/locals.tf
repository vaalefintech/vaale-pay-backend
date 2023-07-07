locals {
  timestamp    = formatdate("YYMMDDhhmmss", timestamp())
  project_name = "vaale_app"
  node_version = "nodejs18.x"
}
