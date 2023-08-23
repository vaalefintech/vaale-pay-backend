export interface VaalePaymentMethod {
  cardId: string;
  cardIdTxt?: string;
  userId?: string;
  expirationDate?: string;
  cvv?: string;
  name?: string;
  lastName?: string;
  wompiStatus?: string; //wompi
  wompiToken?: string; //wompi
  wompiCreated?: string; //wompi
  wompiValidityEndsAt?: string; //wompi
  wompiExpiresAt?: string; //wompi
  wompiSourceStatus?: string; // wompi
  wompiSourceId?: string;
  acceptanceToken?: string;
  delete?: boolean;
  brand?: string;
}
