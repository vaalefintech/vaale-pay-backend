export interface VaalePaymentMethod {
  userId?: string;
  cardId: string;
  expirationDate?: string;
  cvv?: string;
  name?: string;
  lastName?: string;
  delete?: boolean;
}
