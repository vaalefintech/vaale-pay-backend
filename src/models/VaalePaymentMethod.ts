export interface VaalePaymentMethod {
  cardId: string;
  userId?: string;
  expirationDate?: string;
  cvv?: string;
  name?: string;
  lastName?: string;
  status?: string;//wompi
  token?: string;//wompi
  delete?: boolean;
  brand?: string;
}
