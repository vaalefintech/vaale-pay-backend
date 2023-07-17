import { InesperadoException, MyError } from "../utilities/MyError";
import {
  DynamoDBClient,
  ExecuteStatementCommand,
  ExecuteTransactionCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchExecuteStatementCommand,
} from "@aws-sdk/lib-dynamodb";

export interface VaaelTableDesc {
  tableName: string;
  keys: Array<string>;
  rowTypes?: { [key: string]: any };
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
  static getCompundId(tableDesc: VaaelTableDesc, row: any) {
    const values = [];
    const keys = tableDesc.keys;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      values.push(row[key]);
    }
    return values.join("/");
  }
  static getCompundMapIds(tableDesc: VaaelTableDesc, rows: Array<any>) {
    const response: { [key: string]: any } = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowKey = DynamoSrv.getCompundId(tableDesc, row);
      response[rowKey] = row;
    }
    return response;
  }
  static async runInTransaction(input: any) {
    const command = new ExecuteTransactionCommand(input);
    const client = DynamoSrv.getClient();
    const response = await client.docClient.send(command);
    return response;
  }
  static async updateInsertDelete(
    tableDesc: VaaelTableDesc,
    rowsIn: Array<any>
  ) {
    const rowsCreate = [];
    const rowsUpdate = [];
    const rowsDelete: Array<any> = [];
    rowsIn.forEach((row) => {
      if ("delete" in row) {
        if (row.delete === true) {
          rowsDelete.push(row);
        }
        delete row.delete;
      }
    });
    const mapIn = DynamoSrv.getCompundMapIds(tableDesc, rowsIn);
    // Se consultan todas las llaves
    const founds = await DynamoSrv.searchByPk(tableDesc, rowsIn);
    const mapFounds = DynamoSrv.getCompundMapIds(tableDesc, founds);
    const mapDelete = DynamoSrv.getCompundMapIds(tableDesc, rowsDelete);
    // Se calcula el arreglo de los que toca crear
    const allKeys = Object.keys(mapIn);
    for (let i = 0; i < allKeys.length; i++) {
      const aKey = allKeys[i];
      if (!(aKey in mapDelete)) {
        if (!(aKey in mapFounds)) {
          // No existe y toca crearlo
          rowsCreate.push(mapIn[aKey]);
        } else {
          // Ya existe, solo toca actualizarlo
          rowsUpdate.push(mapIn[aKey]);
        }
      }
    }
    // Se pide actualizar los que existen y crear los que no existen
    const promesas = [];
    if (rowsCreate.length > 0) {
      promesas.push(DynamoSrv.insertTable(tableDesc, rowsCreate));
    }
    if (rowsUpdate.length > 0) {
      promesas.push(DynamoSrv.updateByPk(tableDesc, rowsUpdate));
    }
    if (rowsDelete.length > 0) {
      promesas.push(DynamoSrv.deleteByPk(tableDesc, rowsDelete));
    }
    return Promise.all(promesas);
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
    joinTxt: string,
    rowTypes: { [key: string]: string } = {}
  ) {
    const llaves = Object.keys(row);
    const values = [];
    for (let i = 0; i < llaves.length; i++) {
      const llave = llaves[i];
      if (llave in rowTypes) {
        const rowType = rowTypes[llave];
        const temp: { [key: string]: any } = {};
        temp[rowType] = row[llave];
        values.push(temp);
      } else {
        values.push(row[llave]);
      }
    }

    return {
      Statement: `${prefix}${llaves
        .map((llave) => `${prefixRow}${llave}${sufixRow}`)
        .join(joinTxt)}${sufix}`,
      Parameters: values,
    };
  }
  static async updateByPk(
    tableDesc: VaaelTableDesc,
    rows: Array<any>,
    autoExecute = true
  ) {
    try {
      const AHORA = new Date().getTime();
      const statements = {
        Statements: rows.map((row) => {
          row.updated = AHORA;
          const brokedObject = DynamoSrv.filterObject(row, tableDesc.keys);
          const exploded1: any = DynamoSrv.explodeObject(
            `UPDATE ${tableDesc.tableName} SET `,
            brokedObject.resOut,
            "",
            "",
            "=?",
            ", "
          );
          const exploded2: any = DynamoSrv.explodeObject(
            `WHERE `,
            brokedObject.resIn,
            "",
            "",
            "=?",
            " AND "
          );

          let allParams: Array<any> = exploded1.Parameters;
          allParams = allParams.concat(exploded2.Parameters);

          const exploded = {
            Statement: `${exploded1.Statement} ${exploded2.Statement}`,
            Parameters: allParams,
          };
          //console.log(JSON.stringify(exploded, null, 4));
          return exploded;
        }),
      };
      if (autoExecute === false) {
        return statements;
      }
      const command = new BatchExecuteStatementCommand(statements);
      const client = DynamoSrv.getClient();
      const response = await client.docClient.send(command);
      const items = DynamoSrv.checkErrors(response);
      return items;
    } catch (err: any) {
      throw new InesperadoException(err.message);
    }
  }
  static async deleteByPk(
    tableDesc: VaaelTableDesc,
    rows: Array<any>,
    autoExecute = true
  ) {
    try {
      const statements = {
        Statements: rows.map((row) => {
          const brokedObject = DynamoSrv.filterObject(row, tableDesc.keys);
          const exploded: any = DynamoSrv.explodeObject(
            `DELETE FROM ${tableDesc.tableName} WHERE `,
            brokedObject.resIn,
            "",
            "",
            "=?",
            " AND "
          );
          exploded.ConsistentRead = true;
          //console.log(JSON.stringify(exploded, null, 4));
          return exploded;
        }),
      };
      if (autoExecute == false) {
        return statements;
      }
      const command = new BatchExecuteStatementCommand(statements);
      const client = DynamoSrv.getClient();
      const response = await client.docClient.send(command);
      const items = DynamoSrv.checkErrors(response);
      return items;
    } catch (err: any) {
      throw new InesperadoException(err.message);
    }
  }
  static async searchByPkSingle(
    tableDesc: VaaelTableDesc,
    row: any,
    limit: number = 20,
    nextToken: string | null = null
  ) {
    try {
      if (!tableDesc.rowTypes) {
        throw new MyError("Configure rowTypes", 500);
      }
      const brokedObject = DynamoSrv.filterObject(row, tableDesc.keys);
      const exploded: any = DynamoSrv.explodeObject(
        `SELECT * FROM ${tableDesc.tableName} WHERE `,
        brokedObject.resIn,
        "",
        "",
        "=?",
        " AND ",
        tableDesc.rowTypes
      );
      exploded.Limit = limit;
      if (nextToken != null) {
        exploded.NextToken = nextToken;
      }
      exploded.ConsistentRead = false;
      const command = new ExecuteStatementCommand(exploded);

      const client = DynamoSrv.getClient();
      //console.log(JSON.stringify(command, null, 4));
      const response = await client.docClient.send(command);
      //console.log(JSON.stringify(response, null, 4));
      const items = DynamoSrv.checkError(response);
      return items;
    } catch (err: any) {
      throw new InesperadoException(err.message);
    }
  }
  static async searchByPk(
    tableDesc: VaaelTableDesc,
    rows: Array<any>,
    limit: number = 20,
    nextToken: string | null = null,
    oneQueryOneResponse: boolean = false
  ) {
    try {
      const command = new BatchExecuteStatementCommand({
        Statements: rows.map((row) => {
          const brokedObject = DynamoSrv.filterObject(row, tableDesc.keys);
          const exploded: any = DynamoSrv.explodeObject(
            `SELECT * FROM ${tableDesc.tableName} WHERE `,
            brokedObject.resIn,
            "",
            "",
            "=?",
            " AND "
          );
          exploded.Limit = limit;
          if (nextToken != null) {
            exploded.NextToken = nextToken;
          }
          exploded.ConsistentRead = true;
          return exploded;
        }),
      });

      const client = DynamoSrv.getClient();
      const response = await client.docClient.send(command);
      const items = DynamoSrv.checkErrors(response, oneQueryOneResponse);
      return items;
    } catch (err: any) {
      throw new InesperadoException(err.message);
    }
  }
  static async insertTable(
    tableDesc: VaaelTableDesc,
    rows: Array<any>,
    autoExecute = true
  ) {
    try {
      const AHORA = new Date().getTime();
      const statements = {
        Statements: rows.map((row) => {
          row.updated = AHORA;
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
      };
      if (autoExecute === false) {
        return statements;
      }
      const command = new BatchExecuteStatementCommand(statements);
      const client = DynamoSrv.getClient();
      const response = await client.docClient.send(command);
      DynamoSrv.checkErrors(response);
      return response;
    } catch (err: any) {
      console.log(err);
      throw new InesperadoException(err.message);
    }
  }
  static checkErrors(response: any, oneQueryOneResponse: boolean = false) {
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
      //console.log(JSON.stringify(respuesta, null, 4));
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
      } else {
        if (oneQueryOneResponse) {
          realResponse.push(null);
        }
      }
    }
    return realResponse;
  }
  static encodeItem(item: any) {
    const tipo = typeof item;
    if (item === null) {
      return { NULL: true };
    }
    if (tipo == "string") {
      return { S: item };
    } else if (tipo == "boolean") {
      return { BOOL: item };
    } else if (tipo == "number") {
      return { N: `${item}` };
    }
    throw new MyError(`No se soporta el tipo de dato "${tipo}"`, 500);
  }
  static decodeItem(item: any) {
    const keys = Object.keys(item);
    const response: { [key: string]: any } = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const rawValue = item[key];
      if ("S" in rawValue) {
        response[key] = rawValue["S"];
      } else if ("N" in rawValue) {
        response[key] = parseFloat(rawValue["N"]);
      } else {
        throw new MyError(`No se soporta el tipo de dato "${rawValue}"`, 500);
      }
      // TODO seguir con los demás tipos, por ejemplo B para boolean
    }
    return response;
  }
  static checkError(response: any) {
    if (response["$metadata"].httpStatusCode !== 200) {
      throw new InesperadoException(
        `Error accediendo a la base de datos ${response["$metadata"].httpStatusCode}`
      );
    }
    // Itera las respuestas y retorna el primer error
    //console.log(JSON.stringify(response, null, 4));
    const items = response["Items"];
    const realResponse: Array<any> = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      realResponse.push(DynamoSrv.decodeItem(item));
    }
    return {
      nextToken: response.NextToken,
      items: realResponse,
    };
  }
}
