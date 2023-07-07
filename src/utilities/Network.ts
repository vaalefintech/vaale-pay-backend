import express, { Request, Response } from "express";
import { VaaleResponse } from "../models/VaaleResponse";
import { MyError } from "./MyError";

export async function checkAuthenticated(
  req: Request,
  res: Response,
  next: Function
) {
  try {
    const algo: any = req;
    res.locals.user = algo.auth.payload;
    await next();
  } catch (err) {
    const respuesta: VaaleResponse = {
      ok: false,
      body: "Error de autenticación",
    };
    res.status(403).send(respuesta);
  }
}

export async function commonHeaders(
  req: Request,
  res: Response,
  next: Function
) {
  res.setHeader("Content-Type", "application/json");
  await next();
}

export async function vaalePing(req: Request, res: Response, next: Function) {
  const respuesta: VaaleResponse = {
    ok: true,
    body: "Ok!",
  };
  res.send(respuesta);
}

export function handleErrors(error: Error, res: Response) {
  if (error instanceof MyError && typeof error.httpCode == "number") {
    res.status(error.httpCode);
  } else {
    res.status(500);
  }
  const respuesta: VaaleResponse = {
    ok: false,
    error: error.message,
  };
  res.send(respuesta);
}

export function handleErrorsDecorator(someFun: Function) {
  return async (req: Request, res: Response, next: Function) => {
    try {
      await someFun(req, res, next);
    } catch (error: any) {
      console.log(error);
      if (error.response && error.response.body) {
        console.log(JSON.stringify(error.response.body));
      }
      res.locals.myerror = error;
      handleErrors(error, res);
    }
  };
}
