import axios, { AxiosResponse } from "axios";
import { Request, Response } from "express";
import { VaalePaymentMethod } from "../models/VaalePaymentMethod";
import { VaaleResponse } from "../models/VaaleResponse";
import { General } from "../utilities/General";
import { DynamoSrv, VaaelTableDesc } from "./DynamoSrv";
import { PayMethodSrv } from "./PayMethodSrv";
import md5 from "md5";
import { UserSrv } from "./UserSrv";

const DEFAUL_PAGE_SIZE = 20;

export class PaymentsSrv {
  //PaymentsSrv.CURRENCY
  static CURRENCY = "COP";
  static getTableDescPrimary(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_payment`,
      keys: ["userId"],
      rowTypes: { userId: "S" },
    };
  }
  static getTableDescByDate(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_payment.PayByDate`,
      keys: ["userId"],
      rowTypes: { userId: "S" },
    };
  }
  static getTableDescPrimaryUUID(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_payment`,
      keys: ["userId", "uuid"],
      rowTypes: { userId: "S", uuid: "S" },
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
      PaymentsSrv.getTableDescByDate(),
      {
        userId,
      },
      size,
      nextToken,
      " ORDER BY updated DESC"
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

  // PaymentsSrv.processWompiError(error.response.data.messages)
  static processWompiError(error: any) {
    // {"number":["El número de tarjeta es inválido. Luhn check falló."]}
    let texto = "";
    const llaves = Object.keys(error);
    for (let i = 0; i < llaves.length; i++) {
      const llave = llaves[i];
      const lista = error[llave];
      texto += `Errores de "${llave}": ${lista.join(", ")}.`;
    }
    return texto;
  }

  /*
  {
      "ok": true,
      "body": {
          "acceptance_token": "eyJhbGciOiJIUzI1NiJ9.eyJjb250cmFjdF9pZCI6NDEsInBlcm1hbGluayI6Imh0dHBzOi8vd29tcGkuY29tL2Fzc2V0cy9kb3dubG9hZGJsZS9UQy1Vc3Vhcmlvcy1Db2xvbWJpYS5wZGYiLCJmaWxlX2hhc2giOiJiZjcyMmFjZDExYzRjMzQzMTVjMDg1NWIyMmIyOGI5OSIsImppdCI6IjE2OTI2NTA0MTItMTA1NTciLCJlbWFpbCI6IiIsImV4cCI6MTY5MjY1NDAxMn0.CYBMvqHtkdBjrE8HidBrCero1gcQWAu13C4dfXzzVt8",
          "permalink": "https://wompi.com/assets/downloadble/TC-Usuarios-Colombia.pdf",
          "type": "END_USER_POLICY"
      }
  }
  */
  static async acceptanceTokenStep(
    req: Request,
    res: Response,
    next: Function
  ) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    const url = process.env.WOMPI_URL;
    const path = "/merchants/";
    const pubKey = process.env.WOMPI_PUB_KEY;
    const completeUrl = `${url}${path}${pubKey}`;
    const options = {};
    const getResponse: AxiosResponse<any, any> = await new Promise(
      (resolve, reject) => {
        axios
          .get(completeUrl, options)
          .then((res) => {
            resolve(res);
          })
          .catch((error) => {
            reject(error);
          });
      }
    );
    respuesta.body = getResponse.data.data.presigned_acceptance;
    res.status(200).send(respuesta);
  }

  static async queryTransactions(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    const url = process.env.WOMPI_URL;
    const path = "/transactions";
    const completeUrl = `${url}${path}`;
    const options = {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        Authorization: `Bearer ${process.env.WOMPI_PRI_KEY}`,
      },
    };
    const getResponse: AxiosResponse<any, any> = await new Promise(
      (resolve, reject) => {
        axios
          .get(completeUrl, options)
          .then((res) => {
            resolve(res);
          })
          .catch((error) => {
            reject(error);
          });
      }
    );
    /*
    console.log(getResponse.data);
    console.log(`getResponse.status = ${getResponse.status}`);
    console.log(`getResponse.statusText = ${getResponse.statusText}`);
    console.log(getResponse.headers);
    console.log(getResponse.config);
    */
    respuesta.body = getResponse.data;
    res.status(200).send(respuesta);
  }

  static async cardTokenization(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };

    const url = process.env.WOMPI_URL;
    const path = "/tokens/cards";
    const completeUrl = `${url}${path}`;

    const paymentMethod: VaalePaymentMethod = General.readParam(
      req,
      "payload",
      null,
      true
    );

    if (!paymentMethod.expirationDate) {
      throw new Error("Se requiere la fecha de expiración");
    }
    if (!paymentMethod.cvv) {
      throw new Error("Se requiere el cvv/cvc");
    }
    if (!paymentMethod.name) {
      throw new Error("Se requiere el nombre");
    }
    const expirationDateTokens = /^([\d]{2})\/([\d]{2})$/.exec(
      paymentMethod.expirationDate
    );
    if (expirationDateTokens == null) {
      throw new Error("La fecha de expiración debe tener el formato ##/##");
    }
    if (/^[\d]{3,4}$/.exec(paymentMethod.cvv) == null) {
      throw new Error("El cvv/cvc debe tener consistir en 3 o 4 digitos");
    }

    // Leer la tarjeta
    const userId = General.getUserId(res);
    const cardId = paymentMethod.cardId;
    const cardIdHash = md5(cardId);
    const cardUpdate: any = {
      userId,
      cardId: cardIdHash,
    };

    const tableDesc = PayMethodSrv.getTableDescUpdate();
    const founds = await DynamoSrv.searchByPk(
      tableDesc,
      [cardUpdate],
      1,
      null,
      true
    );
    const found = founds[0];
    if (found == null) {
      throw new Error(
        "La tarjeta no se puede tokenizar porque no está creada para el usuario"
      );
    }

    if (found.wompiStatus == "CREATED") {
      throw new Error("La tarjeta no necesita ser tokenizada");
    }

    const payload = {
      number: paymentMethod.cardId,
      exp_month: expirationDateTokens[1],
      exp_year: expirationDateTokens[2],
      cvc: paymentMethod.cvv,
      card_holder: paymentMethod.name,
    };

    // Invocar el servicio
    const options = {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        Authorization: `Bearer ${process.env.WOMPI_PUB_KEY}`,
      },
    };

    const getResponse: AxiosResponse<any, any> = await new Promise(
      (resolve, reject) => {
        axios
          .post(completeUrl, payload, options)
          .then((res) => {
            resolve(res);
          })
          .catch((error) => {
            reject(
              new Error(
                PaymentsSrv.processWompiError(
                  error.response.data.error.messages
                )
              )
            );
          });
      }
    );

    found.wompiStatus = getResponse.data.status;
    if (found.wompiStatus == "CREATED") {
      found.wompiToken = getResponse.data.data.id;
      found.wompiCreated = getResponse.data.data.created_at;
      found.wompiValidityEndsAt = getResponse.data.data.validity_ends_at;
      found.wompiExpiresAt = getResponse.data.data.expires_at;
    }

    await DynamoSrv.updateByPk(tableDesc, [found]);

    respuesta.body = found;
    res.status(200).send(respuesta);
  }

  // Paso 2: Crea una fuente de pago
  static async createPaymentSource(
    req: Request,
    res: Response,
    next: Function
  ) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    const userId = General.getUserId(res);
    const acceptanceToken: string = General.readParam(
      req,
      "acceptanceToken",
      null,
      true
    );
    const cardId: string = General.readParam(req, "cardId", null, true);
    let email: string | null = General.readParam(req, "email", null, false);
    let validatedEmail = "";
    if (typeof email == "string") {
      validatedEmail = email;
    } else {
      // Busco el usuario actual

      const myUser = await UserSrv.getUserById(userId);
      if (myUser == null) {
        throw new Error(
          "Debe proveer el correo o debe haber configurado el usuario previamente."
        );
      } else {
        if (typeof myUser.email != "string") {
          throw new Error(
            "Debe proveer el correo o debe haber asociado un correo al usuario previamente."
          );
        } else {
          validatedEmail = myUser.email;
        }
      }
    }
    const cardIdHash = md5(cardId);
    const cardFound = await PayMethodSrv.getPaymentMethod(userId, cardIdHash);
    if (cardFound == null) {
      throw new Error("La tarjeta no se encontró");
    }
    if (cardFound.wompiStatus != "CREATED") {
      console.log(JSON.stringify(cardFound, null, 4));
      throw new Error("La tarjeta se debe tokenizar primero");
    }

    if (cardFound.wompiSourceStatus == "AVAILABLE") {
      throw new Error("La tarjeta ya se configuró como fuente de pago");
    }

    const url = process.env.WOMPI_URL;
    const path = "/payment_sources";
    const completeUrl = `${url}${path}`;

    const payload = {
      type: "CARD",
      token: cardFound.wompiToken,
      customer_email: validatedEmail,
      //https://docs.wompi.co/docs/colombia/tokens-de-aceptacion/
      acceptance_token: acceptanceToken, // TODO guardar en Dynamo como el Card
    };

    const options = {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        Authorization: `Bearer ${process.env.WOMPI_PRI_KEY}`,
      },
    };

    const getResponse: AxiosResponse<any, any> = await new Promise(
      (resolve, reject) => {
        axios
          .post(completeUrl, payload, options)
          .then((res) => {
            resolve(res);
          })
          .catch((error) => {
            reject(
              new Error(
                PaymentsSrv.processWompiError(
                  error.response.data.error.messages
                )
              )
            );
          });
      }
    );

    cardFound.wompiSourceStatus = getResponse.data.data.status;
    if (cardFound.wompiSourceStatus == "AVAILABLE") {
      cardFound.wompiSourceId = getResponse.data.data.id;
    }

    const tableDesc = PayMethodSrv.getTableDescUpdate();
    await DynamoSrv.updateByPk(tableDesc, [cardFound]);

    respuesta.body = cardFound;
    res.status(200).send(respuesta);
  }

  // Genera una firma de integridad
  // https://docs.wompi.co/docs/colombia/widget-checkout-web/#paso-3-genera-una-firma-de-integridad
  static async generateIntegritySignature(
    transactionRef: string,
    amountInCents: number,
    currency: string,
    withSha = true
  ): Promise<String> {
    /*
    Referencia de la transacción: sk8-438k4-xmxm392-sn2m
    Monto de la transacción en centavos: 2490000
    Moneda de la transacción: COP
    Secreto de integridad: prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6
    */
    const cadenaConcatenada = `${transactionRef}${amountInCents}${currency}${process.env.WOMPI_INTEGRIDAD}`;
    if (!withSha) {
      return cadenaConcatenada;
    }
    const encondedText = new TextEncoder().encode(cadenaConcatenada);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encondedText);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex;
  }

  static async createTransaction(req: Request, res: Response, next: Function) {
    //
    const transactionId = "2354246";
    const amountInCents = 23570 * 100;
    const customerEmail = "example@gmail.com";
    const cuotas = 2;
    const paymentSourceId = 3891;

    const currency = PaymentsSrv.CURRENCY;
    const wompiRoot = process.env.WOMPI_URL;
    const path = "/transactions";
    const payload = {
      amount_in_cents: amountInCents, // Monto current centavos
      currency: currency, // Moneda
      signature: await PaymentsSrv.generateIntegritySignature(
        transactionId,
        amountInCents,
        currency
      ), //Firma de integridad
      customer_email: customerEmail, // Email del usuario
      payment_method: {
        installments: cuotas, // Número de cuotas si la fuente de pago representa una tarjeta de lo contrario el campo payment_method puede ser ignorado.
      },
      reference: transactionId, // Referencia única de pago
      payment_source_id: paymentSourceId, // ID de la fuente de pago
      recurrent: true, // Recurrente opcional...
    };

    const response = {
      data: {
        id: 3891,
        public_data: {
          type: "CARD",
        },
        type: "CARD",
        status: "AVAILABLE",
      },
    };
  }
}
