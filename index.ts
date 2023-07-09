import express, { Express, Request, Response } from "express";
import awsServerlessExpress from "aws-serverless-express";
import dotenv from "dotenv";
const { auth } = require("express-oauth2-jwt-bearer");
import {
  checkAuthenticated,
  commonHeaders,
  handleErrorsDecorator,
  vaalePing,
} from "./src/utilities/Network";
import { ProductSrv } from "./src/services/ProductsSrv";
import { ShoppingCart } from "./src/services/ShoppingCart";

dotenv.config();

const app: Express = express();
const port = process.env.PORT;

// https://auth0.github.io/node-oauth2-jwt-bearer/interfaces/AuthOptions.html
// https://devid.vaale.co/auth/realms/vaale/.well-known/openid-configuration
const authParams = {
  issuerBaseURL: process.env.OAUTH_ISSUER_BASE_URL,
  issuer: process.env.OAUTH_ISSUER,
  jwksUri: process.env.OAUTH_JWKS_URI,
  audience: process.env.OAUTH_AUDIENCE,
  authRequired: false,
};

app.use(auth(authParams));

// Page shopping cart products
app.post(`${process.env.PREFIX_PATH}/api/shopping_cart/page_products`, [
  commonHeaders,
  checkAuthenticated,
  express.json(),
  handleErrorsDecorator(ShoppingCart.pageProducts),
]);
// Remove a product from the shopping cart
app.post(`${process.env.PREFIX_PATH}/api/shopping_cart/remove_product`, [
  commonHeaders,
  checkAuthenticated,
  express.json(),
  handleErrorsDecorator(ShoppingCart.removeProduct),
]);
// Update a product from the shopping cart
app.post(`${process.env.PREFIX_PATH}/api/shopping_cart/update_product`, [
  commonHeaders,
  checkAuthenticated,
  express.json(),
  handleErrorsDecorator(ShoppingCart.updateProduct),
]);
// Add a product to the shopping cart
app.post(`${process.env.PREFIX_PATH}/api/shopping_cart/add_product`, [
  commonHeaders,
  checkAuthenticated,
  express.json(),
  handleErrorsDecorator(ShoppingCart.addProduct),
]);
// Search product by codebar
app.post(`${process.env.PREFIX_PATH}/api/product/bycodebar`, [
  commonHeaders,
  express.json(),
  handleErrorsDecorator(ProductSrv.searchProductByBarCode),
]);
// Upload products
app.post(`${process.env.PREFIX_PATH}/api/product/upload`, [
  commonHeaders,
  express.json(),
  handleErrorsDecorator(ProductSrv.upload),
]);
// Just ping service
app.post(`${process.env.PREFIX_PATH}/api`, vaalePing);

if (process.env.DEV_MODE === "false") {
  const server = awsServerlessExpress.createServer(app);
  exports.handler = (event: any, context: any) =>
    awsServerlessExpress.proxy(server, event, context);
} else {
  app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
  });
}
