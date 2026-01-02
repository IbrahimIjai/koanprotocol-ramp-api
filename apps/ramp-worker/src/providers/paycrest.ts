import axios, { AxiosInstance } from 'axios';
import { RampOrderRequest, RampOrderResponse, RampProvider, RampRate } from '../types';

export class PaycrestProvider implements RampProvider {
  name = 'paycrest';
  private apiKey: string;
  private apiSecret: string;
  private client: AxiosInstance;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.client = axios.create({
      baseURL: 'https://api.paycrest.io/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getRate(token: string, amount: number, currency: string, network: string): Promise<RampRate> {
    try {
      const response = await this.client.get(`/rates/${token}/${amount}/${currency}`, {
        params: { network },
      });

      return {
        token,
        amount,
        currency,
        network,
        rate: response.data.data,
        provider: this.name,
      };
    } catch (error: any) {
      throw new Error(`Paycrest rate fetch failed: ${error.message}`);
    }
  }

  async createOrder(order: RampOrderRequest): Promise<RampOrderResponse> {
    const payload = {
      amount: order.amount,
      token: order.token,
      network: order.network,
      rate: order.rate,
      recipient: {
        institution: order.recipient.institution,
        accountIdentifier: order.recipient.accountIdentifier,
        accountName: order.recipient.accountName,
        memo: order.recipient.memo,
        currency: order.recipient.currency,
        providerId: order.recipient.providerId,
        metadata: order.recipient.metadata,
      },
      reference: order.reference,
      returnAddress: order.returnAddress,
    };

    try {
      const response = await this.client.post('/sender/orders', payload, {
        headers: {
          'API-Key': this.apiKey,
        },
      });

      const responseData = response.data;
      // Paycrest returns { status: "success", message: "...", data: { ... } }
      const data = responseData.data;

      return {
        id: data.id,
        receiveAddress: data.receiveAddress,
        validUntil: data.validUntil,
        senderFee: data.senderFee?.toString(),
        transactionFee: data.transactionFee?.toString(),
        status: 'pending',
        provider: this.name,
        metadata: data,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      throw new Error(`Paycrest order creation failed: ${errorMsg}`);
    }
  }

  async verifyWebhookSignature(request: Request): Promise<boolean> {
    const signature = request.headers.get('X-Paycrest-Signature');
    if (!signature) return false;

    const body = await request.clone().text();
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.apiSecret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );

    const calculatedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return signature === calculatedSignature;
  }

  async handleWebhook(payload: any): Promise<any> {
    return {
      id: payload.data.id,
      status: payload.event,
      originalPayload: payload,
    };
  }

  async getSupportedCurrencies(): Promise<any> {
    try {
      const response = await this.client.get('/currencies');
      return response.data;
    } catch (error: any) {
      throw new Error(`Paycrest currencies fetch failed: ${error.message}`);
    }
  }
}
