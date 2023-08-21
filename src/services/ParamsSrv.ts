import { VaaleResponse } from "../models/VaaleResponse";
import { Request, Response } from "express";
import NodeRSA from "node-rsa";
import pkgCriptoJs from "crypto-js";
const { AES } = pkgCriptoJs;
import Utf8 from "crypto-js/enc-utf8.js";
import { General } from "../utilities/General";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

export interface ParamCrypt {
  public: string;
  private: string;
  in: string;
  out?: string;
}

export class ParamsSrv {
  static generateKeyPair = (tamanio = 512) => {
    const key = new NodeRSA({ b: tamanio });
    key.setOptions({ encryptionScheme: "pkcs1" });
    const respose = {
      public: key.exportKey(`pkcs1-public-pem`),
      private: key.exportKey(`pkcs1-private-pem`),
    };
    return respose;
  };
  static generateKey(keyLength = 10) {
    // define the characters to pick from
    const chars =
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz*&-%/!?*+=()";
    let randomstring = "";
    for (let i = 0; i < keyLength; i++) {
      const rnum = Math.floor(Math.random() * chars.length);
      randomstring += chars.substring(rnum, rnum + 1);
    }
    return randomstring;
  }
  static cifrar(texto: string, llavePublica: string) {
    llavePublica = llavePublica.replace("\n", "");
    const miniKey = ParamsSrv.generateKey(10);
    const format = `pkcs1-public-pem`;
    const key = new NodeRSA(llavePublica, format);
    const encryptedKey = key.encrypt(miniKey, "base64");
    const aesEncrypted = AES.encrypt(texto, miniKey);
    const encryptedMessage = aesEncrypted.toString();
    return Buffer.from(
      JSON.stringify({
        llave: encryptedKey,
        mensaje: encryptedMessage,
      })
    ).toString("base64");
  }
  static decifrar(texto: string, llavePrivada: string) {
    llavePrivada = llavePrivada.replace("\n", "");
    const parametroSinBase64 = JSON.parse(
      Buffer.from(texto, "base64").toString("utf8")
    );
    const format = `pkcs1-private-pem`;
    const key = new NodeRSA(llavePrivada, format);
    const llaveDesencriptada = key.decrypt(parametroSinBase64["llave"], "utf8");
    var desencriptado = AES.decrypt(
      parametroSinBase64["mensaje"],
      llaveDesencriptada
    ).toString(Utf8);
    return desencriptado;
  }
  static async encode(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    const payload: ParamCrypt = General.readParam(req, "payload", null, true);
    payload.out = ParamsSrv.cifrar(payload.in, payload.public);
    respuesta.body = payload;
    res.status(200).send(respuesta);
  }
  static async decode(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    const payload: ParamCrypt = General.readParam(req, "payload", null, true);
    payload.out = ParamsSrv.decifrar(payload.in, payload.private);
    respuesta.body = payload;
    res.status(200).send(respuesta);
  }
  static async getpair(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    const par = ParamsSrv.generateKeyPair();
    respuesta.body = par;
    res.status(200).send(respuesta);
  }
  static async read(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    const client = new SecretsManagerClient({
      region: process.env.REGION,
    });
    let response;
    const secret_name = `${process.env.ENVIRONMENT}_vaale_app_params`;
    response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
      })
    );
    const secret = response.SecretString;
    respuesta.body = secret;
    res.status(200).send(respuesta);
  }
}
