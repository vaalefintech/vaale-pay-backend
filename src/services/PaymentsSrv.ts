import { Request, Response } from "express";
import { VaaleResponse } from "../models/VaaleResponse";

const DEFAUL_PAGE_SIZE = 20;

export class PaymentsSrv {
  static async pagePaymentHistory(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    res.status(200).send(respuesta);
  }
}
