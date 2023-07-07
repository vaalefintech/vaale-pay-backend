resource "aws_apigatewayv2_api" "lambda" {
  name          = "${var.environment}_${local.project_name}_gw"
  protocol_type = "HTTP"
}

resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/api_gw/${var.environment}/${aws_apigatewayv2_api.lambda.name}"
  retention_in_days = 30
}

resource "aws_apigatewayv2_stage" "lambda" {
  api_id      = aws_apigatewayv2_api.lambda.id
  name        = "${var.environment}_${local.project_name}_stage"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format = jsonencode({
      requestId               = "$context.requestId"
      sourceIp                = "$context.identity.sourceIp"
      requestTime             = "$context.requestTime"
      protocol                = "$context.protocol"
      httpMethod              = "$context.httpMethod"
      resourcePath            = "$context.resourcePath"
      routeKey                = "$context.routeKey"
      status                  = "$context.status"
      responseLength          = "$context.responseLength"
      integrationErrorMessage = "$context.integrationErrorMessage"
      }
    )
  }
}

resource "aws_apigatewayv2_integration" "vaale_lambda" {
  api_id             = aws_apigatewayv2_api.lambda.id
  integration_uri    = aws_lambda_function.lambda_app_srv.invoke_arn
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "vaale_lambda" {
  api_id    = aws_apigatewayv2_api.lambda.id
  route_key = "POST /api"
  target    = "integrations/${aws_apigatewayv2_integration.vaale_lambda.id}"
}

resource "aws_apigatewayv2_route" "vaale_lambda_shopping_cart" {
  api_id    = aws_apigatewayv2_api.lambda.id
  route_key = "POST /api/shopping_cart/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.vaale_lambda.id}"
}

resource "aws_apigatewayv2_route" "vaale_lambda_product" {
  api_id    = aws_apigatewayv2_api.lambda.id
  route_key = "POST /api/product/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.vaale_lambda.id}"
}

resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_app_srv.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.lambda.execution_arn}/*/*"
}

output "base_url" {
  description = "Base URL for API Gateway stage."
  value       = "POST ${aws_apigatewayv2_stage.lambda.invoke_url}/api"
}
