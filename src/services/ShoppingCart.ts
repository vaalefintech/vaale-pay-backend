import { Request, Response } from "express";
import { VaaleProduct } from "../models/VaaleProduct";
import { VaaleResponse } from "../models/VaaleResponse";
import { VaaleShoppingCartDetail } from "../models/VaaleShoppingCartDetail";
import { VaaleShoppingCartProduct } from "../models/VaaleShoppingCartProduct";
import { General } from "../utilities/General";
import { MyError } from "../utilities/MyError";
import { DynamoSrv, VaaelTableDesc } from "./DynamoSrv";
import { ProductSrv } from "./ProductsSrv";
import { v4 as uuidv4 } from "uuid";
import { VaalePaymentHistory } from "../models/VaalePaymentHistory";
import { PayMethodSrv } from "./PayMethodSrv";
import { PaymentsSrv } from "./PaymentsSrv";

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
  static getTableDescUpdateDone(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_shopping_cart_done_product`,
      keys: ["userId", "marketId"],
    };
  }
  static async close(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Cargar todos los productos
    // Cargar el medio de pago
    const marketId = General.readParam(req, "marketId", null, true);
    const marketIdClosed = `${marketId}/closed`;
    const uuid = `${marketId}/${uuidv4()}`;
    const userId = General.getUserId(res);
    const currentShoppingCart: VaalePaymentHistory = General.readParam(
      req,
      "payload",
      null,
      true
    );
    const products = currentShoppingCart.products;
    if (!(products instanceof Array)) {
      throw new MyError(`El carrito de compras no tiene productos.`, 400);
    }

    // Se valida el payment method
    if (!currentShoppingCart.cardId) {
      throw new MyError(`No se asignó el método de pago`, 400);
    }
    const promesaPaymentMethod = PayMethodSrv.searchExactPaymentMethod(
      userId,
      currentShoppingCart.cardId
    );

    // Se asegura que el market id sea el actual
    // Se asegura el usuario actual
    const originalProducts = [];
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      product.marketId = marketId;
      product.userId = userId;
      const productId = `${marketId}/${product.codebar}`;
      product.productId = productId;
      originalProducts.push({
        userId,
        productId,
      });
    }

    // Leer de la base de datos el producto en sí por desconfianza de los valores que se envían desde el frontend
    const promesasLectura = [];
    promesasLectura.push(
      ProductSrv.searchProductByBarCodeInternal(products, true)
    );
    promesasLectura.push(
      ShoppingCart.searchProductByBarCodeInternal(products, true)
    );

    const respuestasPromesasLectura = await Promise.all(promesasLectura);
    const reales = respuestasPromesasLectura[0];
    const realesCart = respuestasPromesasLectura[1];

    // Se sobreescriben los valores
    for (let i = 0; i < products.length; i++) {
      const producto = products[i];
      const real = reales[i];
      const realCart = realesCart[i];
      if (real == null) {
        throw new MyError(
          `El producto ${producto.codebar} no existe en el comercio ${marketId}`,
          400
        );
      }
      if (realCart == null) {
        throw new MyError(
          `El producto ${producto.codebar} no existe en el carrito de compras`,
          400
        );
      }
      Object.assign(producto, real);
    }

    let total = 0;
    let taxes = 0;
    // Actualizar _shopping_cart_product con:
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      product.marketId = uuid;
      product.originalMarketId = marketId;
      product.productId = `${uuid}/${product.codebar}`;
      let valor = product.quantity * product.price;
      if (typeof product.taxes == "number") {
        const productTaxes = valor * product.taxes;
        taxes += productTaxes;
        valor += productTaxes;
      }
      total += valor;
    }
    // Totalizar
    currentShoppingCart.total = total;
    currentShoppingCart.taxes = taxes;

    const paymentMethodsFound = await promesaPaymentMethod;
    if (paymentMethodsFound.items.length == 0) {
      throw new MyError(`El usuario no tiene el método de pago proveído`, 400);
    }
    //currentShoppingCart.paymentMethod = paymentMethodsFound.items[0];

    // Persistir en transacción
    // Se persiste como tal el encabezado del pago
    const onlyProducts = currentShoppingCart.products;
    delete currentShoppingCart.products;
    currentShoppingCart.uuid = uuid;
    currentShoppingCart.userId = userId;
    currentShoppingCart.marketId = marketId;

    const promesas = [];
    if (onlyProducts) {
      // Se crea el encabezado de la compra
      promesas.push(
        DynamoSrv.insertTable(PaymentsSrv.getTableDescPrimary(), [
          currentShoppingCart,
        ])
      );
      // Se persiste el detalle de cada producto
      promesas.push(
        DynamoSrv.insertTable(
          ShoppingCart.getTableDescUpdateDone(),
          onlyProducts
        )
      );
      // Se borra el carrito de compras actual
      promesas.push(
        DynamoSrv.deleteByPk(
          ShoppingCart.getTableDescUpdate(),
          originalProducts
        )
      );
    }

    await Promise.all(promesas);

    respuesta.body = onlyProducts;

    res.status(200).send(respuesta);
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

  static async searchProductByBarCodeInternal(
    query: Array<any>,
    oneQueryOneResponse: boolean = false
  ) {
    return await DynamoSrv.searchByPk(
      ShoppingCart.getTableDescPrimary(),
      query,
      1,
      null,
      oneQueryOneResponse
    );
  }
}
