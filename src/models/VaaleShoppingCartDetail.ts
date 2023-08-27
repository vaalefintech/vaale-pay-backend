import { VaaleProduct } from "./VaaleProduct";
import { VaaleShoppingCartProduct } from "./VaaleShoppingCartProduct";

export interface VaaleShoppingCartDetail
  extends VaaleProduct,
    VaaleShoppingCartProduct {}

export interface WompiStartTransactionData {
  uuid: string;
  total: number;
  cuotas: number;
  cardId: string;
  email?: string | null;
}

export interface WompiTransactionResponseData {
  transactionId: string;
  createdAt: string;
  finalizedAt?: string | null;
  status: string; // APPROVED | DECLINED | VOIDED | ERROR
  statusTxt: string;
  email?: string | null;
  paymentId?: string | null;
  created?: number | null;
}
