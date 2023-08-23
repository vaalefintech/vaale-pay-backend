import { Request, Response } from "express";
import { VaalePaymentMethod } from "../models/VaalePaymentMethod";
import { VaaleResponse } from "../models/VaaleResponse";
import { General } from "../utilities/General";
import { DynamoSrv, VaaelTableDesc } from "./DynamoSrv";
import { UserData } from "../models/VaaleUserData";

export class UserSrv {
  static getTableDescPrimary(): VaaelTableDesc {
    return {
      tableName: `${process.env.ENVIRONMENT}_user`,
      keys: ["userId"],
      rowTypes: { userId: "S" },
    };
  }
  static async getUserById(userId: string): Promise<UserData | null> {
    const found = await DynamoSrv.searchByPkSingle(
      UserSrv.getTableDescPrimary(),
      { userId },
      1
    );
    if (found.items.length == 0) {
      return null;
    }
    const first: UserData = found.items[0];
    return first;
  }
  static async updateCurrentUser(req: Request, res: Response, next: Function) {
    const respuesta: VaaleResponse = {
      ok: true,
    };
    const userId = General.getUserId(res);
    // Se leen los parámetros
    const userData: UserData = General.readParam(req, "payload", null, true);
    userData.userId = userId;
    // Se pide actualizar
    await DynamoSrv.updateInsertDelete(UserSrv.getTableDescPrimary(), [
      userData,
    ]);
    res.status(200).send(respuesta);
  }
}
