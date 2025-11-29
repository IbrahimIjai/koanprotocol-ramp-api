import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getRates } from './routes/rates';
import { getCurrencies } from './routes/currencies';
import { createOrder } from './routes/orders';
import { handleWebhook } from './routes/webhooks';

type Bindings = {
  PAYCREST_API_KEY: string;
  PAYCREST_API_SECRET: string;
  DEXPAY_API_KEY: string;
  DEXPAY_API_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

app.get('/', (c) => c.text('Ramp Worker API'));

app.get('/rates', getRates);
app.get('/currencies', getCurrencies);
app.post('/orders', createOrder);
app.post('/webhooks/:provider', handleWebhook);

export default app;
