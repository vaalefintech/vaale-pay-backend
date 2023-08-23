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
