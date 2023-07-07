import { Request, Response } from "express";
import { VaaleProduct } from "../models/VaaleProduct";
import { VaaleResponse } from "../models/VaaleResponse";
import { General } from "../utilities/General";

const DEFAUL_PAGE_SIZE = 20;

export class ShoppingCart {
  static async pageProducts(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se lee el parámetro
    const offset = General.readParam(req, "offset", 0, false);
    const size = General.readParam(req, "size", DEFAUL_PAGE_SIZE, false);
    const userId = General.getUserId(res);

    // Se busca
    const page: Array<VaaleProduct> = [];
    const marketId = "carulla";
    const codeBar = "2342345";
    page.push({
      id: `${marketId}:${codeBar}`,
      codebar: codeBar,
      label: `Prod ${codeBar}`,
      marketId: marketId,
      price: 1000,
      quantity: 1,
    });
    respuesta.body = page;

    // Se responde
    res.status(200).send(respuesta);
  }

  static async addProduct(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    // Se lee el parámetro
    const product: VaaleProduct = General.readParam(req, "product", null, true);
    const userId = General.getUserId(res);

    // Se busca
    respuesta.body = product;

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
