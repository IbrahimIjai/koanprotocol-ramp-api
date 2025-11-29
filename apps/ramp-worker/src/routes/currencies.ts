import { Context } from 'hono';
import { PaycrestProvider } from '../providers/paycrest';
import { DexpayProvider } from '../providers/dexpay';
import { ProviderConfig } from '../config/providers';

export const getCurrencies = async (c: Context) => {
  const providerName = c.req.query('provider');

  if (!providerName) {
    return c.json({ error: 'Provider is required' }, 400);
  }

  let provider;
  if (providerName === ProviderConfig.PAYCREST) {
    provider = new PaycrestProvider(c.env.PAYCREST_API_KEY, c.env.PAYCREST_API_SECRET);
  } else if (providerName === ProviderConfig.DEXPAY) {
    provider = new DexpayProvider(c.env.DEXPAY_API_KEY, c.env.DEXPAY_API_SECRET);
  }

  if (!provider) {
    return c.json({ error: 'Invalid provider' }, 400);
  }

  try {
    const currencies = await provider.getSupportedCurrencies();
    return c.json(currencies);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
};
