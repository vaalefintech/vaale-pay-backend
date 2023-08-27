import { VaalePaymentMethod } from "./VaalePaymentMethod";
import { VaaleShoppingCartDetail } from "./VaaleShoppingCartDetail";

export interface VaalePaymentHistory {
  userId?: string;
  uuid?: string; //marketId + uuid
  updated?: number;
  total?: number;
  taxes?: number;
  marketId?: string;
  cardId?: string;
  cuotas?: number;
  cardIdTxt?: string;

  wompiTransactionId?: string;
  wompiStatus?: string;
  wompiStatusTxt?: string;

  products?: Array<VaaleShoppingCartDetail>;
}
