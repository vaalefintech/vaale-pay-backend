import { Request, Response } from "express";
import { VaaleProduct } from "../models/VaaleProduct";
import { VaaleResponse } from "../models/VaaleResponse";
import {
  VaaleShoppingCartDetail,
  WompiStartTransactionData,
} from "../models/VaaleShoppingCartDetail";
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
  //payment = await ShoppingCart.startTransaction(payment, email, userId, created);
  static async startTransaction(
    payment: any,
    email: string,
    userId: string,
    created: number
  ) {
    const transactionData: WompiStartTransactionData = {
      cardId: payment.cardId,
      cuotas: payment.cuotas,
      total: payment.total,
      uuid: payment.uuidn,
      email,
    };
    const respuestaPago = await PaymentsSrv.createTransaction(
      transactionData,
      userId
    );
    payment.wompiStatus = respuestaPago.status;
    payment.wompiTransactionId = respuestaPago.transactionId;
    payment.wompiCreatedAt = respuestaPago.createdAt;
    payment.wompiFinalizedAt = respuestaPago.finalizedAt;
    payment.wompiStatusTxt = respuestaPago.statusTxt;
    payment.wompiEmail = respuestaPago.email;
    // Se debe actualizar el payment

    const comandos = [];
    comandos.push(
      await DynamoSrv.updateByPk(
        PaymentsSrv.getTableDescPrimaryUUID(),
        [payment],
        false
      )
    );
    // Se crea el registro de log
    respuestaPago.paymentId = `${payment.userId}/${payment.uuid}`;
    respuestaPago.paymentIdN = `${payment.userId}/${payment.uuidn}`;
    respuestaPago.created = created;
    comandos.push(
      await DynamoSrv.insertTable(
        PaymentsSrv.getTablePrimaryPaymentLog(),
        [respuestaPago],
        false
      )
    );
    await DynamoSrv.myRunTransactionCommands(comandos);
    return payment;
  }
  static redefineUUIDN(payment: any) {
    if (typeof payment.uuidn != "string") {
      const uuid = payment.uuid;
      payment.uuidn = `${uuid}_1`;
    } else {
      const uuidn = payment.uuidn;
      const partes = /^([^_]+)_([\d]+)$/.exec(uuidn);
      if (partes != null) {
        const uuid = partes[1];
        const intento = parseInt(partes[2]) + 1;
        payment.uuidn = `${uuid}_${intento}`;
      }
    }
  }
  static async wompiForceTryPay(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    const AHORA = new Date();
    const created = General.getDayAsContinuosNumberHmmSS(AHORA);
    const email = General.readParam(req, "email", null, false);
    // Pido el identificador del pago
    const uuid = General.readParam(req, "uuid", null, true);
    const userId = General.getUserId(res);

    // Para reintentar un pago fallido:
    const retry = General.readParam(req, "retry", "0", false);
    const cuotas = parseInt(General.readParam(req, "cuotas", 1, false));
    if (isNaN(cuotas)) {
      throw new MyError(`Se esperaba un número en cuotas "${cuotas}"`, 400);
    }
    const cardId = General.readParam(req, "cardId", null, false);

    // Leo el pago
    const paymentList = await DynamoSrv.searchByPkSingle(
      PaymentsSrv.getTableDescPrimaryUUID(),
      {
        userId,
        uuid,
      },
      1,
      null
    );
    if (paymentList.items.length == 0 || paymentList.items[0] == null) {
      throw new MyError(`No existe el pago "${uuid}"`, 400);
    }
    const payment = paymentList.items[0];
    if (
      retry == "1" &&
      ["APPROVED", "PENDING"].indexOf(payment.wompiStatus) >= 0
    ) {
      // Si está en cualquiera de esos escenarios no se puede reintentar
      throw new MyError(
        `Acción no permitida porque la transacción está "${payment.wompiStatus}"`,
        400
      );
    }
    // Casuistica del pago
    if ([null, undefined, ""].indexOf(payment.wompiStatus) >= 0) {
      // Se intenta hacer el pago por primera vez...
      ShoppingCart.redefineUUIDN(payment);
      await ShoppingCart.startTransaction(payment, email, userId, created);
      respuesta.body = payment;
    } else if (
      ["APPROVED", "DECLINED", "VOIDED", "ERROR"].indexOf(
        payment.wompiStatus
      ) >= 0
    ) {
      if (["APPROVED"].indexOf(payment.wompiStatus) < 0) {
        // Solo si no está aprovada se mira si se desea reintentar
        if (retry == "1") {
          if (cardId != null) {
            payment.cardId = cardId; // Se actualiza el método de pago
          }
          payment.wompiStatus = null;
          payment.wompiStatusTxt = null;
          payment.wompiFinalizedAt = null;
          payment.wompiTransactionId = null;
          payment.wompiCreatedAt = null;
          payment.wompiEmail = null;
          ShoppingCart.redefineUUIDN(payment);
          await ShoppingCart.startTransaction(payment, email, userId, created);
        }
      }
      // Nada que hacer, toca intentar otra transacción
      respuesta.body = payment;
    } else if (["PENDING"].indexOf(payment.wompiStatus) >= 0) {
      // Se invoca el servicio que verifica el estado del pago
      const respuestaPago = await PaymentsSrv.queryTransaction(
        payment.wompiTransactionId
      );
      if (respuestaPago.status != payment.wompiStatus) {
        // Solo si es diferente lo actualizo
        payment.wompiStatus = respuestaPago.status;
        payment.wompiStatusTxt = respuestaPago.statusTxt;
        payment.wompiFinalizedAt = respuestaPago.finalizedAt;
        const comandos = [];
        comandos.push(
          await DynamoSrv.updateByPk(
            PaymentsSrv.getTableDescPrimaryUUID(),
            [payment],
            false
          )
        );
        // Se crea el registro de log
        respuestaPago.paymentId = `${payment.userId}/${payment.uuid}`;
        respuestaPago.created = created;
        comandos.push(
          await DynamoSrv.insertTable(
            PaymentsSrv.getTablePrimaryPaymentLog(),
            [respuestaPago],
            false
          )
        );
        await DynamoSrv.myRunTransactionCommands(comandos);
      }
      respuesta.body = payment;
    }
    res.status(200).send(respuesta);
  }
  static async closePaging(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se debe ir paginando los productos actuales del carrito de compras
    const size = General.readParam(req, "size", DEFAUL_PAGE_SIZE, false);
    const userId = General.getUserId(res);
    const marketId = General.readParam(req, "marketId", null, true);
    const cuotas = parseInt(General.readParam(req, "cuotas", 1, false));
    if (isNaN(cuotas)) {
      throw new MyError(`Se esperaba un número en cuotas "${cuotas}"`, 400);
    }
    const cardId = General.readParam(req, "cardId", null, true);
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
      cuotas,
      cardId,
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
        respuesta.body = {
          cuenta: currentShoppingCart,
          done: true,
        };

        res.status(200).send(respuesta);
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

    await DynamoSrv.myRunTransactionCommands(comandos);

    respuesta.body = {
      cuenta: currentShoppingCart,
      done: products.length == 0,
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
