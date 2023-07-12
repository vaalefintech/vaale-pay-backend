import { VaalePaymentMethod } from "./VaalePaymentMethod";
import { VaaleShoppingCartDetail } from "./VaaleShoppingCartDetail";

export interface VaalePaymentHistory {
  userId: string;
  updated: number; // AAAAMMddHHmmss
  paymentMethod: VaalePaymentMethod;
  products: Array<VaaleShoppingCartDetail>;
}
