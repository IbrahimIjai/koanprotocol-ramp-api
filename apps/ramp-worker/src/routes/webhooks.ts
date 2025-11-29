import { Context } from 'hono';
import { PaycrestProvider } from '../providers/paycrest';
import { DexpayProvider } from '../providers/dexpay';
import { ProviderConfig } from '../config/providers';

export const handleWebhook = async (c: Context) => {
  const providerName = c.req.param('provider');
  let provider;

  if (providerName === ProviderConfig.PAYCREST) {
    provider = new PaycrestProvider(c.env.PAYCREST_API_KEY, c.env.PAYCREST_API_SECRET);
  } else if (providerName === ProviderConfig.DEXPAY) {
    provider = new DexpayProvider(c.env.DEXPAY_API_KEY, c.env.DEXPAY_API_SECRET);
  }

  if (!provider) {
    return c.json({ error: 'Invalid provider' }, 400);
  }

  const isValid = await provider.verifyWebhookSignature(c.req.raw);
  if (!isValid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const payload = await c.req.json();
  const result = await provider.handleWebhook(payload);

  console.log(`Webhook received for ${providerName}:`, result);

  return c.json({ status: 'ok' });
};
