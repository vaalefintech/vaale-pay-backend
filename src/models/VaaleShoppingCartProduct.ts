export interface VaaleShoppingCartProduct {
  id: string; // PK: userId + marketId + codebar
  productId: string; // marketId + codebar
  shoppingCartId: string; // userId + marketId
  userId: string;
  quantity: number;
  updated?: number; // AAAAMMddHHmmss
}
