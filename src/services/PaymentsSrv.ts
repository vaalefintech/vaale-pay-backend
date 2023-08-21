import { Request, Response } from "express";
import { VaaleResponse } from "../models/VaaleResponse";
import { General } from "../utilities/General";
import { DynamoSrv, VaaelTableDesc } from "./DynamoSrv";

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

  // Authorization: Bearer ${process.env.WOMPI_PRI_KEY}
  static async acceptanceTokenStep(
    req: Request,
    res: Response,
    next: Function
  ) {
    var url = process.env.WOMPI_URL;
    const path = "/v1/merchants/";
    var pubKey = process.env.WOMPI_PUB_KEY;

    var completeUrl = "$url$path$pubKey";

    // Se debe hacer un GET a completeUrl
    const response = {
      data: {
        presigned_acceptance: {
          acceptance_token: "eyJhbGciOiJIUzI1NiJ9.eyJjb250cmFjdF9pZCIExNzMxZj",
          permalink:
            "https://wompi.co/wp-content/uploads/2019/09/TERMINOS-Y-CONDICIONES-DE-USO-USUARIOS-WOMPI.pdf",
          type: "END_USER_POLICY",
        },
      },
    };

    // Se debe mostrar al usuario un checkbox con este enlace:
    // response.data.presigned_acceptance.permalink
  }

  static async cardTokenization(req: Request, res: Response, next: Function) {
    var url = process.env.WOMPI_URL;
    const path = "/v1/tokens/cards";
    const payload = {
      number: "4242424242424242", // Número de tarjeta (como un string, sin espacios)
      exp_month: "06", // Mes de expiración (como string de 2 dígitos)
      exp_year: "29", // Año de expiración (como string de 2 dígitos)
      cvc: "123", // Código de seguridad (como string de 3 o 4 dígitos)
      card_holder: "Pedro Pérez", // Nombre del tarjeta habiente (string de mínimo 5 caracteres)
    };

    // Response
    const response = {
      status: "CREATED",
      data: {
        id: "tok_prod_15_44c5638281if67l04eA63f705bfA5bde", // TODO guardar en Dynamo como el Card
        created_at: "2020-09-07T19:09:31.585+00:00",
        brand: "VISA",
        name: "VISA-4242",
        last_four: "4242",
        bin: "538696",
        exp_year: "29",
        exp_month: "06",
        card_holder: "Pedro Pérez",
        expires_at: "2021-09-05T19:09:30.000Z",
      },
    };
  }

  // Paso 2: Crea una fuente de pago
  static async createPaymentSource(
    req: Request,
    res: Response,
    next: Function
  ) {
    // Recibir:
    // acceptance_token de paso acceptanceTokenStep()
    // token de paso cardTokenization()
    // customer_email

    const wompiRoot = process.env.WOMPI_URL;
    const path = "/v1/payment_sources";
    const payload = {
      type: "CARD",
      token: "tok_prod_15_44c5638281if67l04eA63f705bfA5bde",
      customer_email: "pepito_perez@example.com",

      //https://docs.wompi.co/docs/colombia/tokens-de-aceptacion/
      acceptance_token: "eyJhbGciOiJIUzI1NiJ9.eyJjb250cmFjdF9pZCIExNzMxZj", // TODO guardar en Dynamo como el Card
    };

    const response = {
      data: {
        id: 3891, // TODO guardar en Dynamo como el Card
        public_data: {
          type: "CARD",
        },
        type: "CARD",
        status: "AVAILABLE",
      },
    };
  }

  //Genera una firma de integridad
  //https://docs.wompi.co/docs/colombia/widget-checkout-web/#paso-3-genera-una-firma-de-integridad
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
    const path = "/v1/transactions";
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
