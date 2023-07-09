import { Request, Response } from "express";
import { VaaleProduct } from "../models/VaaleProduct";
import { VaaleResponse } from "../models/VaaleResponse";
import { VaaleShoppingCartDetail } from "../models/VaaleShoppingCartDetail";
import { VaaleShoppingCartProduct } from "../models/VaaleShoppingCartProduct";
import { General } from "../utilities/General";
import { MyError } from "../utilities/MyError";
import { DynamoSrv, VaaelTableDesc } from "./DynamoSrv";
import { ProductSrv } from "./ProductsSrv";

const DEFAUL_PAGE_SIZE = 20;

export class ShoppingCart {
  static getTableDescPrimary(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_shopping_cart_product`,
      keys: ["userId", "productId"],
    };
  }
  static getTableDescSecondary(): VaaelTableDesc {
    return {
      tableName: `"${process.env.ENVIRONMENT}_shopping_cart_product"."UserMarket"`,
      keys: ["userId", "marketId"],
      rowTypes: { userId: "S", marketId: "S" },
    };
  }
  static getTableDescUpdate(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_shopping_cart_product`,
      keys: ["userId", "productId"],
    };
  }
  static async pageProducts(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se leen los parámetros
    const nextToken = General.readParam(req, "nextToken", null, false);
    const size = General.readParam(req, "size", DEFAUL_PAGE_SIZE, false);
    const marketId = General.readParam(req, "marketId", null, true);
    const userId = General.getUserId(res);

    respuesta.body = await DynamoSrv.searchByPkSingle(
      ShoppingCart.getTableDescSecondary(),
      {
        userId,
        marketId,
      },
      size,
      nextToken
    );

    // Se responde
    res.status(200).send(respuesta);
  }

  static async addProduct(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se lee el parámetro
    const codebar: string = General.readParam(req, "codebar", null, true);
    const marketId = General.readParam(req, "marketId", null, true);
    const userId = General.getUserId(res);

    // Se debe buscar que exista dicho producto y luego lo agrega
    const existente = await ProductSrv.searchProductByBarCodeInternal(
      codebar,
      marketId
    );
    if (existente.length == 0) {
      throw new MyError(
        `El producto de código ${codebar} no está registrado.`,
        400
      );
    }
    const product = existente[0];

    await DynamoSrv.updateInsertDelete(ShoppingCart.getTableDescUpdate(), [
      {
        userId,
        productId: `${marketId}/${codebar}`,
        marketId,
        quantity: 1,
      },
    ]);

    respuesta.body = {
      product,
    };

    // Se responde
    res.status(200).send(respuesta);
  }

  static async updateProduct(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se lee el parámetro
    const product: VaaleProduct = General.readParam(req, "product", null, true);

    // Se busca
    respuesta.body = product;

    // Se responde
    res.status(200).send(respuesta);
  }

  static async removeProduct(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se lee el parámetro
    const id = General.readParam(req, "id", null, true);

    // Se busca
    respuesta.body = "Ok";

    // Se responde
    res.status(200).send(respuesta);
  }
}
