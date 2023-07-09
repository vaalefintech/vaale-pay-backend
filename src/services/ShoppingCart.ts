import { Request, Response } from "express";
import { VaaleProduct } from "../models/VaaleProduct";
import { VaaleResponse } from "../models/VaaleResponse";
import { VaaleShoppingCartDetail } from "../models/VaaleShoppingCartDetail";
import { VaaleShoppingCartProduct } from "../models/VaaleShoppingCartProduct";
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
    const page: Array<VaaleShoppingCartDetail> = [];
    const marketId = "carulla";
    const codeBar = "2342345";
    page.push({
      userId,
      productId: `${marketId}/${codeBar}`,
      quantity: 1,
      codebar: "7702024062745",
      brand: "Nestle",
      label: "Milo",
      detail: "550g",
      price: 19600,
      marketId,
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
