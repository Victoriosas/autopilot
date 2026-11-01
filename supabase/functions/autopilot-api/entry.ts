// Shared API; privileged keys remain inside the Supabase runtime.
import express from 'express';
import { app } from '../../../api-app';
process.env.AUTOPILOT_RUNTIME = 'supabase-edge';
process.env.VERCEL = '0';
// Preserve opt-in consultation/provider gates. Never enable payments on this host.
process.env.COMMERCE_ATOMIC_CHECKOUT_ENABLED = 'false';
const gateway = express();
gateway.disable('x-powered-by');
gateway.use('/autopilot-api', app);
gateway.listen(8000);
