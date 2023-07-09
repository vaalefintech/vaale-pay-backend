export interface VaaleProduct {
  id: string; // PK: marketId + codebar
  marketId: string;
  codebar: string;
  brand: string;
  label: string;
  detail: string;
  price: number;
  updated?: number; // AAAAMMddHHmmss
}
