import { Request, Response } from "express";
import { VaaleResponse } from "../models/VaaleResponse";
import { General } from "../utilities/General";
import { DynamoSrv, VaaelTableDesc } from "./DynamoSrv";

const DEFAUL_PAGE_SIZE = 20;

export class PaymentsSrv {
  static getTableDescPrimary(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_payment`,
      keys: ["userId"],
      rowTypes: { userId: "S" },
    };
  }
  static getTableDescUpdateDone(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_shopping_cart_done_product`,
      keys: ["userId", "marketId"],
      rowTypes: { userId: "S", marketId: "S" },
    };
  }
  static async pagePaymentHistory(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se leen los parámetros
    const nextToken = General.readParam(req, "nextToken", null, false);
    const size = General.readParam(req, "size", DEFAUL_PAGE_SIZE, false);
    const userId = General.getUserId(res);

    const response = await DynamoSrv.searchByPkSingle(
      PaymentsSrv.getTableDescPrimary(),
      {
        userId,
      },
      size,
      nextToken
    );

    respuesta.body = response;

    res.status(200).send(respuesta);
  }
  static async pagePaymentDetail(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se leen los parámetros
    const nextToken = General.readParam(req, "nextToken", null, false);
    const size = General.readParam(req, "size", DEFAUL_PAGE_SIZE, false);
    const userId = General.getUserId(res);
    const marketId = General.readParam(req, "uuid", null, true);

    const response = await DynamoSrv.searchByPkSingle(
      PaymentsSrv.getTableDescUpdateDone(),
      {
        userId,
        marketId,
      },
      size,
      nextToken
    );

    respuesta.body = response;

    res.status(200).send(respuesta);
  }
}
