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

    const response = await DynamoSrv.searchByPkSingle(
      ShoppingCart.getTableDescSecondary(),
      {
        userId,
        marketId,
      },
      size,
      nextToken
    );

    const marketIdLength = marketId.length + 1;
    const products = response.items;

    if (products.length > 0) {
      // Se le agrega el codebar para hacer la consulta
      products.forEach((product) => {
        product.codebar = product.productId.substring(marketIdLength);
      });
      // Acá se simula el JOIN ...
      const existentes = await ProductSrv.searchProductByBarCodeInternal(
        products,
        true
      );
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const detail = existentes[i];
        if (detail != null) {
          Object.assign(product, detail);
        }
      }
    }
    respuesta.body = response;

    // Se responde
    res.status(200).send(respuesta);
  }

  static async updateProductInternal(
    codebar: string,
    marketId: string,
    userId: string,
    quantity: number
  ) {
    if (quantity > 0) {
      // Se debe buscar que exista dicho producto y luego lo agrega
      const existente = await ProductSrv.searchProductByBarCodeInternal(
        [{ codebar, marketId }],
        false
      );
      if (existente.length == 0) {
        throw new MyError(
          `El producto de código ${codebar} no está registrado.`,
          400
        );
      }
      const product = existente[0];

      const shoppingCartProduct = {
        userId,
        productId: `${marketId}/${codebar}`,
        marketId,
        quantity,
      };

      await DynamoSrv.updateInsertDelete(ShoppingCart.getTableDescUpdate(), [
        shoppingCartProduct,
      ]);

      Object.assign(product, shoppingCartProduct);
      return product;
    } else {
      // Solo se borra
      const product = {
        userId,
        productId: `${marketId}/${codebar}`,
      };
      await DynamoSrv.deleteByPk(ShoppingCart.getTableDescUpdate(), [product]);
      return null;
    }
  }

  static async addProduct(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se leen los parámetros
    const codebar: string = General.readParam(req, "codebar", null, true);
    const marketId = General.readParam(req, "marketId", null, true);
    const userId = General.getUserId(res);

    const product = await ShoppingCart.updateProductInternal(
      codebar,
      marketId,
      userId,
      1
    );

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
    // Se leen los parámetros
    const codebar: string = General.readParam(req, "codebar", null, true);
    const quantity: number = General.readParam(req, "quantity", 0, true);
    const marketId = General.readParam(req, "marketId", null, true);
    const userId = General.getUserId(res);

    const product = await ShoppingCart.updateProductInternal(
      codebar,
      marketId,
      userId,
      quantity
    );

    respuesta.body = {
      product,
    };

    // Se responde
    res.status(200).send(respuesta);
  }

  static async removeProduct(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se leen los parámetros
    const codebar: string = General.readParam(req, "codebar", null, true);
    const marketId = General.readParam(req, "marketId", null, true);
    const userId = General.getUserId(res);

    const product = await ShoppingCart.updateProductInternal(
      codebar,
      marketId,
      userId,
      0
    );

    respuesta.body = {
      product,
    };

    // Se responde
    res.status(200).send(respuesta);
  }
}
