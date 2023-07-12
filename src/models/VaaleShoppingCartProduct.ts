export interface VaaleShoppingCartProduct {
  userId: string;
  productId: string;
  marketId: string;
  quantity: number;
  updated?: number;
  delete?: boolean;
  uuid?: string;
}
