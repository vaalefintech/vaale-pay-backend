import { Request, Response } from "express";
import { VaaleResponse } from "../models/VaaleResponse";

const DEFAUL_PAGE_SIZE = 20;

export class PayMethodSrv {
  static async updatePaymentMethod(
    req: Request,
    res: Response,
    next: Function
  ) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    res.status(200).send(respuesta);
  }
  static async pagePaymentMethods(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    res.status(200).send(respuesta);
  }
}
