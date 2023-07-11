resource "aws_dynamodb_table" "vaale_product_table" {
  name           = "${var.environment}_product"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "marketId"
  range_key      = "codebar"

  attribute {
    name = "marketId"
    type = "S"
  }

  attribute {
    name = "codebar"
    type = "S"
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_dynamodb_table" "vaale_shopping_cart_product_table" {
  name           = "${var.environment}_shopping_cart_product"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "userId"
  range_key      = "productId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "productId"
    type = "S"
  }

  attribute {
    name = "marketId"
    type = "S"
  }

  global_secondary_index {
    name               = "UserMarket"
    hash_key           = "userId"
    range_key          = "marketId"
    write_capacity     = 10
    read_capacity      = 10
    projection_type    = "INCLUDE"
    non_key_attributes = ["productId", "quantity"]
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_dynamodb_table" "vaale_payment_method_table" {
  name           = "${var.environment}_payment_method"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "userId"
  range_key      = "cardId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "cardId"
    type = "S"
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_dynamodb_table" "vaale_payment_table" {
  name           = "${var.environment}_payment"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "userId"
  range_key      = "timestamp"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  tags = {
    Environment = var.environment
  }
}
