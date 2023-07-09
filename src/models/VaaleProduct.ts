export interface VaaleProduct {
  marketId: string;
  codebar: string;
  brand: string;
  label: string;
  detail: string;
  price: number;
  updated?: number; // AAAAMMddHHmmss
  delete?: boolean;
}
