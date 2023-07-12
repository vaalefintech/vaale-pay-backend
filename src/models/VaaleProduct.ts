export interface VaaleProduct {
  marketId: string;
  codebar: string;
  brand: string;
  label: string;
  detail: string;
  price: number;
  taxes?: number; //Porcentaje 0.19 por ejemplo del iva
  updated?: number; // AAAAMMddHHmmss
  delete?: boolean;
}
