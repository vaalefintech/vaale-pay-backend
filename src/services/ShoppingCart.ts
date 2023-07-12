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
  static async closePaging(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se debe ir paginando los productos actuales del carrito de compras
    const size = General.readParam(req, "size", DEFAUL_PAGE_SIZE, false);
    const userId = General.getUserId(res);
    const marketId = General.readParam(req, "marketId", null, true);
    let uuid = General.readParam(req, "uuid", null, false);
    let providedUUID = true;
    if (uuid == null) {
      providedUUID = false;
      uuid = `${marketId}/${uuidv4()}`;
    }
    const promesasIniciales = [];

    // Se buscan los productos del carito de compras
    promesasIniciales.push(
      DynamoSrv.searchByPkSingle(
        ShoppingCart.getTableDescSecondary(),
        {
          userId,
          marketId,
        },
        size,
        null
      )
    );

    // Se busca la cuenta que se va a cerrar
    let currentShoppingCart: VaalePaymentHistory = {
      userId,
      uuid,
      marketId,
      total: 0,
      taxes: 0,
    };
    if (providedUUID) {
      // Buscarlo para totalizar
      promesasIniciales.push(
        DynamoSrv.searchByPkSingle(
          PaymentsSrv.getTableDescPrimaryUUID(),
          {
            userId,
            uuid,
          },
          1,
          null
        )
      );
    }

    const respuestaPromesasIniciales = await Promise.all(promesasIniciales);
    const responseProducts = respuestaPromesasIniciales[0];
    const responsePayment = respuestaPromesasIniciales[1];

    if (providedUUID) {
      if (responsePayment.items.length == 0) {
        throw new MyError(`Petición incorrecta con uuid "${uuid}"`, 400);
      }
      currentShoppingCart = responsePayment.items[0];
    }

    const products = responseProducts.items;

    if (!providedUUID) {
      if (products.length == 0) {
        throw new MyError(
          `El usuario no tiene productos en el comercio "${marketId}"`,
          400
        );
      }
    } else {
      if (products.length == 0) {
        res.status(204).send();
        return;
      }
    }

    // Se guarda la referencia de los productos actuales del carrito de compras...
    const originalProducts = [];
    const marketIdSize = marketId.length + 1;
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      product.codebar = product.productId.substring(marketIdSize);
      originalProducts.push({
        userId,
        productId: product.productId,
      });
    }

    const promesasLectura = [];
    promesasLectura.push(
      ProductSrv.searchProductByBarCodeInternal(products, true)
    );

    const respuestasPromesasLectura = await Promise.all(promesasLectura);
    const reales = respuestasPromesasLectura[0];
    // Se completan los productos
    for (let i = 0; i < products.length; i++) {
      const producto = products[i];
      const real = reales[i];
      if (real == null) {
        throw new MyError(
          `El producto ${producto.codebar} no existe en el comercio "${marketId}"`,
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
    if (!(typeof currentShoppingCart.total == "number")) {
      currentShoppingCart.total = 0;
    }
    currentShoppingCart.total += total;
    if (!(typeof currentShoppingCart.taxes == "number")) {
      currentShoppingCart.taxes = 0;
    }
    currentShoppingCart.taxes += taxes;

    const comandos = [];

    // Se crea el encabezado de la compra
    if (providedUUID) {
      // Se actualiza
      comandos.push(
        await DynamoSrv.updateByPk(
          PaymentsSrv.getTableDescPrimaryUUID(),
          [currentShoppingCart],
          false
        )
      );
    } else {
      // Se crea
      comandos.push(
        await DynamoSrv.insertTable(
          PaymentsSrv.getTableDescPrimaryUUID(),
          [currentShoppingCart],
          false
        )
      );
    }
    // Se persiste el detalle de cada producto
    comandos.push(
      await DynamoSrv.insertTable(
        ShoppingCart.getTableDescUpdateDone(),
        products,
        false
      )
    );
    // Se borra el carrito de compras actual
    comandos.push(
      await DynamoSrv.deleteByPk(
        ShoppingCart.getTableDescUpdate(),
        originalProducts,
        false
      )
    );

    const transactions: Array<any> = [];
    const input = {
      TransactStatements: transactions,
    };

    for (let i = 0; i < comandos.length; i++) {
      const comando = comandos[i];
      const statements = comando.Statements;
      if (statements) {
        for (let j = 0; j < statements.length; j++) {
          const oneStatement = statements[j];
          // Convert datatypes
          const parameters = oneStatement.Parameters;
          const parameters2 = [];
          const llaves = Object.keys(parameters);
          for (let k = 0; k < llaves.length; k++) {
            const llave = llaves[k];
            const valor = parameters[llave];
            const transformado = DynamoSrv.encodeItem(valor);
            parameters2.push(transformado);
          }
          oneStatement.Parameters = parameters2;
          transactions.push(oneStatement);
        }
      } else {
        console.log(`Un statement vacío`);
      }
    }

    //console.log(JSON.stringify(transactions, null, 4));
    await DynamoSrv.runInTransaction(input);

    respuesta.body = {
      cuenta: currentShoppingCart,
      products,
    };

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
