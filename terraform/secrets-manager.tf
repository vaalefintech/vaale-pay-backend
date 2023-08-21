
//data.local_file.app_params.content
data "local_file" "app_params" {
  filename = "../secrets/${var.environment}-encoded.txt"
}

/*
module "secrets_manager" {
  source = "terraform-aws-modules/secrets-manager/aws"

  # Secret
  name                    = "${var.environment}_${local.project_name}_params"
  description             = "Vaale Pay App Params"
  recovery_window_in_days = 7

  # Policy
  create_policy       = false
  block_public_policy = true
  policy_statements = {
    lambda = {
      sid = "LambdaReadWrite"
      principals = [{
        type        = "AWS"
        identifiers = [aws_lambda_function.lambda_app_srv.arn]
      }]
      actions = [
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue",
        "secretsmanager:UpdateSecretVersionStage",
      ]
      resources = ["*"]
    }
    read = {
      sid = "AllowAccountRead"
      principals = [{
        type        = "AWS"
        identifiers = ["arn:aws:iam::${var.account}:root"]
      }]
      actions   = ["secretsmanager:DescribeSecret"]
      resources = ["*"]
    }
  }

  # Version
  ignore_secret_changes = false
  secret_string         = data.local_file.app_params.content

  # Rotation
  enable_rotation = false

  tags = {
    Environment = var.environment
  }
}
*/

output "my_secrets" {
  description = "Verify my secrets"
  value       = data.local_file.app_params.content
}
