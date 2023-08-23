import { Request, Response } from "express";
import { VaalePaymentMethod } from "../models/VaalePaymentMethod";
import { VaaleResponse } from "../models/VaaleResponse";
import { General } from "../utilities/General";
import { DynamoSrv, VaaelTableDesc } from "./DynamoSrv";
import md5 from "md5";

const DEFAUL_PAGE_SIZE = 20;

export class PayMethodSrv {
  static getTableDescPrimary(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_payment_method`,
      keys: ["userId"],
      rowTypes: { userId: "S" },
    };
  }
  static getTableDescPrimaryExact(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_payment_method`,
      keys: ["userId", "cardId"],
      rowTypes: { userId: "S", cardId: "S" },
    };
  }
  static getTableDescUpdate(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_payment_method`,
      keys: ["userId", "cardId"],
    };
  }
  static async getPaymentMethod(userId: string, cardId: string) {
    const found = await PayMethodSrv.searchExactPaymentMethod(userId, cardId);
    if (found.items.length == 0) {
      return null;
    }
    const first: VaalePaymentMethod = found.items[0];
    return first;
  }
  static async searchExactPaymentMethod(userId: string, cardId: string) {
    let cardIdHash = cardId;
    if (cardId.length == 16) {
      cardIdHash = md5(cardId);
    }
    const response = await DynamoSrv.searchByPkSingle(
      PayMethodSrv.getTableDescPrimaryExact(),
      {
        userId,
        cardId: cardIdHash,
      },
      1,
      null
    );
    return response;
  }
  static async pagePaymentMethods(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se leen los parámetros
    const nextToken = General.readParam(req, "nextToken", null, false);
    const size = General.readParam(req, "size", DEFAUL_PAGE_SIZE, false);
    const userId = General.getUserId(res);

    const response = await DynamoSrv.searchByPkSingle(
      PayMethodSrv.getTableDescPrimary(),
      {
        userId,
      },
      size,
      nextToken
    );

    respuesta.body = response;

    res.status(200).send(respuesta);
  }
  static async updatePaymentMethod(
    req: Request,
    res: Response,
    next: Function
  ) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se leen los parámetros
    const paymentMethod: VaalePaymentMethod = General.readParam(
      req,
      "payload",
      null,
      true
    );
    const realCardId = paymentMethod.cardId;
    if (realCardId.length == 16) {
      paymentMethod.cardId = md5(realCardId);
      paymentMethod.cardIdTxt = "000000000000" + realCardId.substring(12);
    }
    paymentMethod.cvv = "000";
    paymentMethod.expirationDate = "00/00";
    paymentMethod.userId = General.getUserId(res);
    // Se pide actualizar
    await DynamoSrv.updateInsertDelete(PayMethodSrv.getTableDescUpdate(), [
      paymentMethod,
    ]);

    res.status(200).send(respuesta);
  }
}
