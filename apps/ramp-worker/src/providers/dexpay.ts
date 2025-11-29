import axios, { AxiosInstance } from 'axios';
import { RampOrderRequest, RampOrderResponse, RampProvider, RampRate } from '../types';

export class DexpayProvider implements RampProvider {
  name = 'dexpay';
  private apiKey: string;
  private apiSecret: string;
  private client: AxiosInstance;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.client = axios.create({
      baseURL: 'https://api.dexpay.io/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getRate(token: string, amount: number, currency: string, network: string): Promise<RampRate> {
    try {
      const response = await this.client.get(`/rate/${token}`, {
        params: {
          tokenAmount: amount,
          chain: network.toUpperCase(),
        },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return {
        token,
        amount,
        currency,
        network,
        rate: response.data.rate || response.data, 
        provider: this.name,
      };
    } catch (error: any) {
      throw new Error(`Dexpay rate fetch failed: ${error.message}`);
    }
  }

  async createOrder(order: RampOrderRequest): Promise<RampOrderResponse> {
    const payload = {
      tokenAmount: order.amount,
      asset: order.token,
      chain: order.network.toUpperCase(),
      type: 'SELL',
      bankCode: order.recipient.institution,
      accountName: order.recipient.accountName,
      accountNumber: order.recipient.accountIdentifier,
    };

    try {
      const response = await this.client.post('/quote', payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      const data = response.data;
      return {
        id: data.id || data.quoteId,
        receiveAddress: data.receivingAddress || data.depositAddress,
        status: 'pending',
        provider: this.name,
        metadata: data,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      throw new Error(`Dexpay order creation failed: ${errorMsg}`);
    }
  }

  async verifyWebhookSignature(request: Request): Promise<boolean> {
    const signature = request.headers.get('X-Dexpay-Signature');
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
      id: payload.transactionId,
      status: payload.status,
      originalPayload: payload,
    };
  }
}
