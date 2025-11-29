import { Context } from 'hono';
import { PaycrestProvider } from '../providers/paycrest';
import { DexpayProvider } from '../providers/dexpay';
import { RampProvider } from '../types';
import { ProviderConfig } from '../config/providers';

export const getRates = async (c: Context) => {
  const token = c.req.query('token');
  const amount = parseFloat(c.req.query('amount') || '0');
  const currency = c.req.query('currency');
  const network = c.req.query('network');
  const providerName = c.req.query('provider');

  if (!token || !amount || !currency || !network) {
    return c.json({ error: 'Missing required parameters' }, 400);
  }

  const providers: RampProvider[] = [];
  
  // Helper to instantiate provider
  const addProvider = (name: string) => {
    if (name === ProviderConfig.PAYCREST && c.env.PAYCREST_API_KEY) {
      providers.push(new PaycrestProvider(c.env.PAYCREST_API_KEY, c.env.PAYCREST_API_SECRET));
    } else if (name === ProviderConfig.DEXPAY && c.env.DEXPAY_API_KEY) {
      providers.push(new DexpayProvider(c.env.DEXPAY_API_KEY, c.env.DEXPAY_API_SECRET));
    }
  };

  if (providerName) {
    addProvider(providerName);
  } else {
    addProvider(ProviderConfig.PAYCREST);
    addProvider(ProviderConfig.DEXPAY);
  }

  if (providers.length === 0) {
    return c.json({ error: 'No providers available' }, 404);
  }

  const rates = await Promise.allSettled(
    providers.map(p => p.getRate(token, amount, currency, network).catch(e => ({ error: e.message, provider: p.name })))
  );

  const successfulRates = rates
    .filter(r => r.status === 'fulfilled')
    .map((r: any) => r.value);

  return c.json({ rates: successfulRates });
};
