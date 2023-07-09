import { Request, Response } from "express";
import { VaaleResponse } from "../models/VaaleResponse";
import { General } from "../utilities/General";
import { DynamoSrv, VaaelTableDesc } from "./DynamoSrv";

export class ProductSrv {
  static getTableDesc(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_product`,
      keys: ["marketId", "codebar"],
    };
  }
  static async upload(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    const payload: Array<any> = General.readParam(req, "payload", null, true);
    // Pass it to dynamo
    await DynamoSrv.updateInsertDelete(ProductSrv.getTableDesc(), payload);
    res.status(200).send(respuesta);
  }
  static async searchProductByBarCode(
    req: Request,
    res: Response,
    next: Function
  ) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se lee el parámetro
    const codebar = General.readParam(req, "codebar", null, true);
    const marketId = General.readParam(req, "marketId", null, true);

    respuesta.body =
      // Se responde
      res.status(200).send(respuesta);
  }
  static async searchProductByBarCodeInternal(
    query: Array<any>,
    oneQueryOneResponse: boolean = false
  ) {
    return await DynamoSrv.searchByPk(
      ProductSrv.getTableDesc(),
      query,
      1,
      null,
      oneQueryOneResponse
    );
  }
}
