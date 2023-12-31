import axios, { AxiosResponse } from "axios";
import { Request, Response } from "express";
import { VaalePaymentMethod } from "../models/VaalePaymentMethod";
import { VaaleResponse } from "../models/VaaleResponse";
import { General } from "../utilities/General";
import { DynamoSrv, VaaelTableDesc } from "./DynamoSrv";
import { PayMethodSrv } from "./PayMethodSrv";
import md5 from "md5";
import { UserSrv } from "./UserSrv";
import {
  WompiStartTransactionData,
  WompiTransactionResponseData,
} from "../models/VaaleShoppingCartDetail";
import sha256 from "crypto-js/sha256";

const DEFAUL_PAGE_SIZE = 20;

export class PaymentsSrv {
  static CURRENCY = "COP";
  static WOMPI_STATUS_DESC: { [key: string]: string } = {
    APPROVED: "Transacción aprobada",
    DECLINED: "Transacción rechazada",
    VOIDED: "Transacción anulada", // (sólo aplica para transacciones con tarjeta)
    ERROR: "Error interno",
    PENDING: "Pendiente",
  };
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
  static getTablePrimaryPaymentLog(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_payment_log`,
      keys: ["paymentId", "transactionId"],
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

  // WOMPI
  static wompiGetHeaders(isPublic: boolean) {
    return {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        Authorization: `Bearer ${
          isPublic ? process.env.WOMPI_PUB_KEY : process.env.WOMPI_PRI_KEY
        }`,
      },
    };
  }

  static processWompiError(error: any) {
    let texto = "";
    const llaves = Object.keys(error);
    for (let i = 0; i < llaves.length; i++) {
      const llave = llaves[i];
      const lista = error[llave];
      texto += `Wompi: errores de "${llave}": ${lista.join(", ")}.`;
    }
    return texto;
  }

  static async computeUserEmail(
    email: string | null | undefined,
    userId: string
  ): Promise<string> {
    let validatedEmail = "";
    if (typeof email == "string") {
      validatedEmail = email;
    } else {
      // Intento tomarlo diréctamente del userId
      const userIdTokens = /^(email|google)\/(.+)$/gi.exec(userId);
      if (userIdTokens != null) {
        validatedEmail = userIdTokens[2];
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
    }
    return validatedEmail;
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

  static async cardTokenization(req: Request, res: Response, next: Function) {
    console.log("Tokenize...");
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

    // Se eliminan posibles campos en blanco
    paymentMethod.cardId = paymentMethod.cardId.replace(/\s*/gi, "");

    const userId = General.getUserId(res);
    const tableDesc = PayMethodSrv.getTableDescUpdate();

    if (paymentMethod.delete === true) {
      if (paymentMethod.cardId.length == 16) {
        paymentMethod.cardId = md5(paymentMethod.cardId);
      }
      const cardDelete: any = {
        userId,
        cardId: paymentMethod.cardId,
      };
      await DynamoSrv.deleteByPk(tableDesc, [cardDelete]);
      res.status(200).send(respuesta);
      return;
    }

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
      throw new Error("El cvv/cvc debe tener de 3 a 4 digitos");
    }

    // Leer la tarjeta

    const cardId = paymentMethod.cardId;
    const cardIdHash = md5(cardId);
    const cardUpdate: any = {
      userId,
      cardId: cardIdHash,
    };

    const founds = await DynamoSrv.searchByPk(
      tableDesc,
      [cardUpdate],
      1,
      null,
      true
    );
    const found = founds[0];
    if (found !== null) {
      throw new Error(
        "Ya existe una tarjeta asociada al usuario con el mismo número"
      );
    }

    const payload = {
      number: paymentMethod.cardId,
      exp_month: expirationDateTokens[1],
      exp_year: expirationDateTokens[2],
      cvc: paymentMethod.cvv,
      card_holder: paymentMethod.name,
    };

    // Invocar el servicio
    const options = PaymentsSrv.wompiGetHeaders(true);

    const getResponse: AxiosResponse<any, any> = await new Promise(
      (resolve, reject) => {
        axios
          .post(completeUrl, payload, options)
          .then((res) => {
            resolve(res);
          })
          .catch((error) => {
            // Acá se espera que wompi genere todos los errores
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

    if (getResponse.data.status == "CREATED") {
      // Se crea entonces en dynamo ofuscando sus datos
      const realCardId = paymentMethod.cardId;
      paymentMethod.cardId = cardIdHash;
      paymentMethod.cardIdTxt =
        realCardId.substring(0, 4) + "00000000" + realCardId.substring(12);
      paymentMethod.cvv = "000";
      paymentMethod.expirationDate = "00/00";
      paymentMethod.userId = General.getUserId(res);
      paymentMethod.wompiToken = getResponse.data.data.id;
      paymentMethod.wompiCreated = getResponse.data.data.created_at;
      paymentMethod.wompiValidityEndsAt =
        getResponse.data.data.validity_ends_at;
      paymentMethod.wompiExpiresAt = getResponse.data.data.expires_at;
      paymentMethod.wompiStatus = getResponse.data.status;

      await DynamoSrv.insertTable(tableDesc, [paymentMethod]);
      respuesta.body = paymentMethod;
      console.log(JSON.stringify(paymentMethod, null, 4));
      res.status(200).send(respuesta);
    } else {
      // Mensaje de error
      throw new Error("La tarjeta no se pudo crear");
    }
  }

  // Paso 2: Crea una fuente de pago
  static async createPaymentSource(
    req: Request,
    res: Response,
    next: Function
  ) {
    console.log("createPaymentSource...");
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
    const cardId: string = General.readParam(req, "cardId", null, true); //Puede ser el real o el md5
    let email: string | null = General.readParam(req, "email", null, false); //No es obligatorio si se puede sacar del userId
    const validatedEmail = await PaymentsSrv.computeUserEmail(email, userId);
    let cardIdHash = cardId;
    if (cardId.length == 16) {
      cardIdHash = md5(cardId);
    }
    const cardFound = await PayMethodSrv.getPaymentMethod(userId, cardIdHash);
    if (cardFound == null) {
      throw new Error("La tarjeta no se encontró");
    }
    if (cardFound.wompiStatus != "CREATED") {
      throw new Error("La tarjeta se debe tokenizar primero");
    }

    if (cardFound.wompiSourceStatus == "AVAILABLE") {
      //throw new Error("La tarjeta ya se configuró como fuente de pago");
      respuesta.body = cardFound;
      res.status(200).send(respuesta);
      return;
    }

    const url = process.env.WOMPI_URL;
    const path = "/payment_sources";
    const completeUrl = `${url}${path}`;

    const payload = {
      type: "CARD",
      token: cardFound.wompiToken,
      customer_email: validatedEmail,
      //https://docs.wompi.co/docs/colombia/tokens-de-aceptacion/
      acceptance_token: acceptanceToken,
    };

    const options = PaymentsSrv.wompiGetHeaders(false);

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
    console.log(JSON.stringify(getResponse.data.data, null, 4));
    if (cardFound.wompiSourceStatus == "AVAILABLE") {
      cardFound.wompiSourceId = getResponse.data.data.id;
      cardFound.acceptanceToken = acceptanceToken;
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
    const hashBuffer = sha256(cadenaConcatenada);
    return hashBuffer.toString();
  }

  static async createTransaction(
    transactionData: WompiStartTransactionData,
    userId: string
  ) {
    const cardFound = await PayMethodSrv.getPaymentMethod(
      userId,
      transactionData.cardId
    );
    if (cardFound == null) {
      throw new Error("La tarjeta no se encontró");
    }

    const myUser = await UserSrv.getUserById(userId);
    if (myUser == null) {
      throw new Error("El usuario no se encontró.");
    }

    const validatedEmail = await PaymentsSrv.computeUserEmail(
      transactionData.email,
      userId
    );

    const currency = PaymentsSrv.CURRENCY;
    const url = process.env.WOMPI_URL;
    const path = "/transactions";
    const completeUrl = `${url}${path}`;

    const payload = {
      amount_in_cents: transactionData.total * 100, // Monto current centavos
      currency: currency, // Moneda
      signature: await PaymentsSrv.generateIntegritySignature(
        transactionData.uuid,
        transactionData.total * 100,
        currency
      ), //Firma de integridad
      customer_email: validatedEmail, // Email del usuario
      payment_method: {
        installments: transactionData.cuotas, // Número de cuotas si la fuente de pago representa una tarjeta de lo contrario el campo payment_method puede ser ignorado.
      },
      reference: transactionData.uuid, // Referencia única de pago
      payment_source_id: cardFound.wompiSourceId, // ID de la fuente de pago
      recurrent: true, // Recurrente opcional...
    };

    const options = PaymentsSrv.wompiGetHeaders(false);

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
    const data = getResponse.data.data;
    const filtered: WompiTransactionResponseData = {
      transactionId: data.id,
      createdAt: data.created_at,
      status: data.status,
      email: validatedEmail,
      statusTxt: PaymentsSrv.WOMPI_STATUS_DESC[data.status],
    };

    return filtered;
  }

  static async queryTransaction(transactionId: string) {
    const url = process.env.WOMPI_URL;
    const path = `/transactions/${transactionId}`;
    const completeUrl = `${url}${path}`;
    const options = PaymentsSrv.wompiGetHeaders(false);
    const getResponse: AxiosResponse<any, any> = await new Promise(
      (resolve, reject) => {
        axios
          .get(completeUrl, options)
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
    const data = getResponse.data.data;
    const filtered: WompiTransactionResponseData = {
      transactionId: data.id,
      createdAt: data.created_at,
      finalizedAt: data.finalized_at,
      status: data.status,
      statusTxt: PaymentsSrv.WOMPI_STATUS_DESC[data.status],
    };
    return filtered;
  }

  // TODO https://docs.wompi.co/docs/colombia/eventos
}
