import { VaalePaymentMethod } from "./VaalePaymentMethod";
import { VaaleShoppingCartDetail } from "./VaaleShoppingCartDetail";

export interface VaalePaymentHistory {
  userId?: string;
  uuid?: string; //marketId + uuid
  updated?: number;
  total?: number;
  taxes?: number;
  marketId?: string;
  paymentMethod: VaalePaymentMethod;
  products: Array<VaaleShoppingCartDetail>;
}
