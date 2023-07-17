export interface VaalePaymentMethod {
  userId?: string;
  cardId: string;
  brand: string;
  expirationDate?: string;
  cvv?: string;
  name?: string;
  lastName?: string;
  delete?: boolean;
}
