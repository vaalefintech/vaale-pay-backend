import { Request, Response } from "express";
import { VaaleProduct } from "../models/VaaleProduct";
import { VaaleResponse } from "../models/VaaleResponse";
import { General } from "../utilities/General";

export class ProductSrv {
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
      id: `${marketId}:${codeBar}`,
      codebar: codeBar,
      label: `Prod ${codeBar}`,
      marketId: marketId,
      price: 1000,
      quantity: 1,
    };
    respuesta.body = foundProduct;

    // Se responde
    res.status(200).send(respuesta);
  }
}
