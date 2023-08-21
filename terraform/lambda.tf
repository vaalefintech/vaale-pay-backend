data "local_file" "lambda_params" {
  filename = "../secrets/${var.environment}.json"
}

resource "aws_lambda_function" "lambda_app_srv" {
  filename      = var.zipfile
  function_name = "${var.environment}_${local.project_name}_lambda"
  role          = aws_iam_role.lambda_vaale_role.arn
  handler       = "dist/index.handler"

  runtime = local.node_version

  environment {
    variables = {
      DEV_MODE    = "false"
      ENVIRONMENT = var.environment
      PREFIX_PATH = "/${var.environment}_${local.project_name}_stage"
      REGION      = "us-east-1"

      OAUTH_ISSUER_BASE_URL = "https://devid.vaale.co/auth/realms/vaale"
      OAUTH_ISSUER          = "https://devid.vaale.co/auth/realms/vaale"
      OAUTH_JWKS_URI        = "https://devid.vaale.co/auth/realms/vaale/protocol/openid-connect/certs"
      OAUTH_AUDIENCE        = "account"

      WOMPI_URL = {
        dev : "https://sandbox.wompi.co/v1",
        pro : "https://production.wompi.co/v1"
      }[var.environment]

      WOMPI_PUB_KEY    = jsondecode(data.local_file.lambda_params.content).wompi_pub_key
      WOMPI_PRI_KEY    = jsondecode(data.local_file.lambda_params.content).wompi_pri_key
      WOMPI_EVENTOS    = jsondecode(data.local_file.lambda_params.content).wompi_eventos
      WOMPI_INTEGRIDAD = jsondecode(data.local_file.lambda_params.content).wompi_integridad
    }
  }
}

resource "aws_iam_role" "lambda_vaale_role" {
  name               = "${var.environment}_${local.project_name}_lambda_role"
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
  inline_policy {
    name = "${var.environment}_${local.project_name}_lambda_policy"
    policy = jsonencode({
      "Version" : "2012-10-17",
      "Statement" : [
        {
          "Sid" : "LambdaVaale1",
          "Effect" : "Allow",
          "Action" : [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ],
          "Resource" : "*"
        },
        {
          "Sid" : "LambdaDynamo",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*",
          ],
          "Resource" : "*"
        },
        {
          "Sid" : "SecretsManager",
          "Effect" : "Allow",
          "Action" : [
            "secretsmanager:DescribeSecret",
            "secretsmanager:GetSecretValue",
            "secretsmanager:PutSecretValue",
            "secretsmanager:UpdateSecretVersionStage",
          ],
          "Resource" : module.secrets_manager.secret_arn
        }
      ]
    })
  }
}
