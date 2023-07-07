import { Request, Response } from "express";
import { VaaleOathPayload } from "../models/VaaleOathPayload";
import { MyError, NoHayUsuarioException } from "./MyError";

export class General {
  static getUserId(res: Response) {
    if (res.locals["user"]) {
      const tokePayload: VaaleOathPayload = res.locals["user"];
      return `email:${tokePayload.email}`;
    }
    throw new NoHayUsuarioException("No se encontró el usuario");
  }
  static readParam(
    req: Request,
    name: string,
    pred: any = null,
    errorOnFail = false
  ) {
    if (req.body && name in req.body) {
      return req.body[name];
    } else if (req.query && name in req.query) {
      return req.query[name];
    }
    if (errorOnFail) {
      throw new MyError(`Falta el parámetro "${name}".`, 403);
    }
    return pred;
  }
  static toBase64(texto: string) {
    return Buffer.from(texto, "utf8").toString("base64");
  }
  static fromBase64(texto: string) {
    return Buffer.from(texto, "base64").toString("utf8");
  }
  static getNameParts() {
    const ahora = new Date();
    const epochText = ahora.getTime() + "";
    return {
      year: ahora.getFullYear(),
      month: ("0" + (ahora.getMonth() + 1)).slice(-2),
      day: ("0" + ahora.getDate()).slice(-2),
      hours: ("0" + ahora.getHours()).slice(-2),
      minutes: ("0" + ahora.getMinutes()).slice(-2),
      seconds: ("0" + ahora.getSeconds()).slice(-2),
      millis: ("00" + ahora.getMilliseconds()).slice(-3),
      epoch: epochText,
    };
  }
}
