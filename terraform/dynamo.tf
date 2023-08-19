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

resource "aws_dynamodb_table" "vaale_shopping_cart_product_done_table" {
  name           = "${var.environment}_shopping_cart_done_product"
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
  range_key      = "uuid"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "uuid"
    type = "S"
  }

  attribute {
    name = "updated"
    type = "N"
  }

  global_secondary_index {
    name            = "PayByDate"
    hash_key        = "userId"
    range_key       = "updated"
    write_capacity  = 10
    read_capacity   = 10
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_dynamodb_table" "vaale_geomarket_table" {
  name           = "${var.environment}_geomarket"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 10
  hash_key       = "id"
  range_key      = "geohash"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "marketId"
    type = "S"
  }

  attribute {
    name = "geohash"
    type = "S"
  }

  global_secondary_index {
    name            = "ByMarketId"
    hash_key        = "marketId"
    write_capacity  = 10
    read_capacity   = 20
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_dynamodb_table" "vaale_market_table" {
  name           = "${var.environment}_market"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 10
  hash_key       = "marketId"

  attribute {
    name = "marketId"
    type = "S"
  }

  tags = {
    Environment = var.environment
  }
}
