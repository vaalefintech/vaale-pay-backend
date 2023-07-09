import { InesperadoException, MyError } from "../utilities/MyError";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchExecuteStatementCommand,
} from "@aws-sdk/lib-dynamodb";

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
  static explodeObject(prefix: string, row: any) {
    const llaves = Object.keys(row);
    const values = [];
    for (let i = 0; i < llaves.length; i++) {
      const llave = llaves[i];
      values.push(row[llave]);
    }

    return {
      Statement: `${prefix} {${llaves
        .map((llave) => `'${llave}': ?`)
        .join(",")}}`,
      Parameters: values,
    };
  }
  static async updateTable(tableName: string, rows: Array<any>) {
    try {
      const command = new BatchExecuteStatementCommand({
        Statements: rows.map((row) => {
          const exploded = DynamoSrv.explodeObject(
            `INSERT INTO ${tableName} value`,
            row
          );
          // console.log(JSON.stringify(exploded, null, 4));
          return exploded;
        }),
      });

      const client = DynamoSrv.getClient();
      const response = await client.docClient.send(command);
      console.log(JSON.stringify(response));
      if (response["$metadata"].httpStatusCode !== 200) {
        throw new InesperadoException(
          `Error accediendo a la base de datos ${response["$metadata"].httpStatusCode}`
        );
      }
      // Itera las respuestas y retorna el primer error
      const respuestas = response["Responses"];
      for (let i = 0; i < respuestas.length; i++) {
        const respuesta = respuestas[i];
        if (respuesta["Error"] && respuesta["Error"]["Code"]) {
          const code = respuesta["Error"]["Code"];
          const message = respuesta["Error"]["Message"];
          throw new InesperadoException(`${code}: ${message}`);
        }
      }
      return response;
    } catch (err: any) {
      throw new InesperadoException(err.message);
    }
  }
}
