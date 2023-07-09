import { InesperadoException, MyError } from "../utilities/MyError";

export class DynamoSrv {
  static async updateTable(tableName: string, rows: Array<any>) {
    try {
      // Do the job
    } catch (err: any) {
      throw new InesperadoException(err.message);
    }
  }
}
