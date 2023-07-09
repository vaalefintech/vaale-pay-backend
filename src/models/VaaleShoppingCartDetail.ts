import { VaaleProduct } from "./VaaleProduct";
import { VaaleShoppingCartProduct } from "./VaaleShoppingCartProduct";

export interface VaaleShoppingCartDetail
  extends VaaleProduct,
    VaaleShoppingCartProduct {}
