import { InesperadoException, MyError } from "../utilities/MyError";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchExecuteStatementCommand,
} from "@aws-sdk/lib-dynamodb";

export interface VaaelTableDesc {
  tableName: string;
  keys: Array<string>;
}

export class DynamoSrv {
  static client: any = null;
  static docClient: any = null;
  static getClient() {
    if (DynamoSrv.client == null) {
      DynamoSrv.client = new DynamoDBClient({ region: process.env.REGION });
      DynamoSrv.docClient = DynamoDBDocumentClient.from(DynamoSrv.client);
    }
    return {
      client: DynamoSrv.client,
      docClient: DynamoSrv.docClient,
    };
  }
  static filterObject(row: any, columns: Array<string>) {
    const llaves = Object.keys(row);
    const resIn: any = {};
    const resOut: any = {};
    for (let i = 0; i < llaves.length; i++) {
      const column = llaves[i];
      if (columns.indexOf(column) >= 0) {
        resIn[column] = row[column];
      } else {
        resOut[column] = row[column];
      }
    }
    return {
      resIn,
      resOut,
    };
  }
  static explodeObject(
    prefix: string,
    row: any,
    sufix: string,
    prefixRow: string,
    sufixRow: string,
    joinTxt: string
  ) {
    const llaves = Object.keys(row);
    const values = [];
    for (let i = 0; i < llaves.length; i++) {
      const llave = llaves[i];
      values.push(row[llave]);
    }

    return {
      Statement: `${prefix}${llaves
        .map((llave) => `${prefixRow}${llave}${sufixRow}`)
        .join(joinTxt)}${sufix}`,
      Parameters: values,
    };
  }
  static async searchByPk(tableDesc: VaaelTableDesc, rows: Array<any>) {
    try {
      const command = new BatchExecuteStatementCommand({
        Statements: rows.map((row) => {
          const exploded: any = DynamoSrv.explodeObject(
            `SELECT * FROM ${tableDesc.tableName} WHERE `,
            DynamoSrv.filterObject(row, tableDesc.keys).resIn,
            "",
            "",
            "=?",
            " AND "
          );
          exploded.ConsistentRead = true;
          //console.log(JSON.stringify(exploded, null, 4));
          return exploded;
        }),
      });

      const client = DynamoSrv.getClient();
      const response = await client.docClient.send(command);
      const items = DynamoSrv.checkErrors(response);
      return items;
    } catch (err: any) {
      throw new InesperadoException(err.message);
    }
  }
  static async insertTable(tableDesc: VaaelTableDesc, rows: Array<any>) {
    try {
      const command = new BatchExecuteStatementCommand({
        Statements: rows.map((row) => {
          const exploded = DynamoSrv.explodeObject(
            `INSERT INTO ${tableDesc.tableName} value {`,
            row,
            `}`,
            "'",
            "': ?",
            ","
          );
          //console.log(JSON.stringify(exploded, null, 4));
          return exploded;
        }),
      });

      const client = DynamoSrv.getClient();
      const response = await client.docClient.send(command);
      DynamoSrv.checkErrors(response);
      return response;
    } catch (err: any) {
      throw new InesperadoException(err.message);
    }
  }
  static checkErrors(response: any) {
    if (response["$metadata"].httpStatusCode !== 200) {
      throw new InesperadoException(
        `Error accediendo a la base de datos ${response["$metadata"].httpStatusCode}`
      );
    }
    // Itera las respuestas y retorna el primer error
    const respuestas = response["Responses"];
    const realResponse: Array<any> = [];
    for (let i = 0; i < respuestas.length; i++) {
      const respuesta: any = respuestas[i];
      console.log(JSON.stringify(respuesta, null, 4));
      const error = respuesta["Error"];
      if (error) {
        const code = error["Code"];
        if (code) {
          const message = error["Message"];
          throw new InesperadoException(`${code}: ${message}`);
        }
      }

      const item = respuesta["Item"];
      if (item) {
        realResponse.push(item);
      }
    }
    return realResponse;
  }
}
