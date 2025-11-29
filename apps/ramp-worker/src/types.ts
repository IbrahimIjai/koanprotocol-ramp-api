export interface RampRate {
  token: string;
  amount: number;
  currency: string;
  network: string;
  rate: string;
  provider: string;
}

export interface RampOrderRequest {
  amount: number;
  token: string;
  network: string;
  rate: string;
  recipient: {
    institution?: string;
    accountIdentifier: string;
    accountName: string;
    currency: string;
    memo?: string;
    email?: string;
    phoneNumber?: string;
  };
  reference?: string;
  returnAddress?: string;
}

export interface RampOrderResponse {
  id: string;
  receiveAddress: string;
  validUntil?: string;
  senderFee?: string;
  transactionFee?: string;
  status: string;
  provider: string;
  metadata?: any;
}

export interface RampProvider {
  name: string;
  getRate(token: string, amount: number, currency: string, network: string): Promise<RampRate>;
  createOrder(order: RampOrderRequest): Promise<RampOrderResponse>;
  verifyWebhookSignature(request: Request): Promise<boolean>;
  handleWebhook(payload: any): Promise<any>;
}
