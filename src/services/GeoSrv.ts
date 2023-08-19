import { VaaleResponse } from "../models/VaaleResponse";
import { General } from "../utilities/General";
import { Request, Response } from "express";
import { encodeBase32, decodeBase32 } from "geohashing";
import { DynamoSrv, VaaelTableDesc } from "./DynamoSrv";
import { ExecuteStatementCommand } from "@aws-sdk/client-dynamodb";

export interface SingleGeohash {
  lat: number;
  lon: number;
  geohashs?: Array<string>;
}

export interface GeoMarketData {
  id: string;
  geohashs: Array<string>;

  name: string;
  address: string;

  delete?: boolean;
}

export interface MarketDynamoData {
  marketId: string;

  name: string;
  address: string;

  delete?: boolean;
}

export interface GeoMarketDynamoData {
  id: string;
  geohash: string;
  marketId: string;
}

// Los celulares cuentan con precisión de alrededor de 50 metros
/*
deep: 7 ≤ 153m	×	153m
deep: 8 ≤ 38.2m × 19.1m
deep: 9 ≤ 4.77m × 4.77m
*/
// https://geohash.softeng.co/
export class GeoSrv {
  // GeoSrv.getTableMarketDynamoData()
  static getTableMarketDynamoData(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_market`,
      keys: ["marketId"],
      rowTypes: { marketId: "S" },
    };
  }
  static getTableGeoMarketDynamoData(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_geomarket`,
      keys: ["id", "geohash"],
      rowTypes: { id: "S", geohash: "S" },
    };
  }
  static getTableGeoMarketDynamoDataSearch(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_geomarket`,
      keys: ["marketId"],
      rowTypes: { marketId: "S" },
    };
  }
  static async update(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
      msg: "Use https://geohash.softeng.co/",
    };
    const payload: Array<GeoMarketData> = General.readParam(
      req,
      "payload",
      null,
      true
    );

    //const reporte: any = [];
    for (let i = 0; i < payload.length; i++) {
      const market = payload[i];
      // Borro de _geomarket todos las coincidencias con marketId = market.id
      //const verificador: any = { geohashes: [] };
      const olds = await DynamoSrv.searchByPkSingle(
        GeoSrv.getTableGeoMarketDynamoDataSearch(),
        {
          marketId: market.id,
        }
      );
      if (olds.items.length > 0) {
        await DynamoSrv.deleteByPk(
          GeoSrv.getTableGeoMarketDynamoData(),
          olds.items
        );
      }

      // Se generan todas los registros necesarios
      const reemplazo: Array<GeoMarketDynamoData> = [];
      const geohashs = market.geohashs;
      for (let j = 0; j < geohashs.length; j++) {
        const geohash = geohashs[j];
        reemplazo.push({
          id: `${market.id}_${geohash}`,
          marketId: market.id,
          geohash,
        });
      }
      // Se genera el registro de datos generales
      const datoGeneral: MarketDynamoData = {
        marketId: market.id,
        name: market.name,
        address: market.address,
        delete: market.delete,
      };

      //verificador.general = datoGeneral;
      //verificador.geohashes.push(reemplazo);
      //reporte.push(verificador);

      const promesas = [];
      promesas.push(
        DynamoSrv.updateInsertDelete(GeoSrv.getTableMarketDynamoData(), [
          datoGeneral,
        ])
      );
      if (market.delete !== true) {
        // Solo se insertan porque se sabe que se borraron
        promesas.push(
          DynamoSrv.insertTable(GeoSrv.getTableGeoMarketDynamoData(), reemplazo)
        );
      }
      await Promise.all(promesas);
    }
    //respuesta.body = reporte;
    res.status(200).send(respuesta);
  }

  // Cuando se va a buscar se debe generar dada la latitud y longitud el hash de nivel:
  // 7 y 8
  static async search(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    const payload: SingleGeohash = General.readParam(
      req,
      "payload",
      null,
      true
    );
    // Se toma la latitud y longitud y se genera el geohash de deep 7 y 8
    payload.geohashs = [];
    let geohash = encodeBase32(payload.lat, payload.lon, 8);
    payload.geohashs.push(geohash);
    payload.geohashs.push(geohash.substring(0, 7));
    // Se busca la coincidencia

    const statement = `SELECT * FROM ${process.env.ENVIRONMENT}_geomarket WHERE geohash IN [?, ?]`;
    const command = new ExecuteStatementCommand({
      Statement: statement,
      Parameters: [{ S: payload.geohashs[0] }, { S: payload.geohashs[1] }],
    });
    // console.log(statement);
    const client = DynamoSrv.getClient();
    const response = await client.docClient.send(command);
    if (response.Items.length > 0) {
      const respuestas = response.Items;
      const markets: Array<any> = [];
      const foundIndexes: Array<string> = [];
      for (let i = 0; i < respuestas.length; i++) {
        const respuesta = respuestas[i];
        const decodificado = DynamoSrv.decodeItem(respuesta);
        if (foundIndexes.indexOf(decodificado.marketId) < 0) {
          markets.push({
            marketId: decodificado.marketId,
          });
        }
      }

      // Pido buscar los datos completos
      respuesta.body = await DynamoSrv.searchByPk(
        GeoSrv.getTableMarketDynamoData(),
        markets
      );
    } else {
      respuesta.body = [];
    }

    res.status(200).send(respuesta);
  }
}
