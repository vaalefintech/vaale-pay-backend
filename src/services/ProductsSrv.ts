import { Request, Response } from "express";
import { VaaleProduct } from "../models/VaaleProduct";
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
    const readed = await DynamoSrv.deleteByPk(
      ProductSrv.getTableDesc(),
      payload
    );
    respuesta.body = readed;
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
    const codeBar = General.readParam(req, "id", null, true);
    const marketId = General.readParam(req, "marketId", null, true);

    // Se busca y se asinga
    let foundProduct: VaaleProduct = {
      marketId: marketId,
      codebar: codeBar,
      brand: "Nestle",
      label: `Prod ${codeBar}`,
      detail: "45g",
      price: 1000,
    };
    respuesta.body = foundProduct;

    // Se responde
    res.status(200).send(respuesta);
  }
}
