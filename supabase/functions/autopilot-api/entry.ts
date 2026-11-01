// Shared API; privileged keys remain inside the Supabase runtime.
import express from 'express';
import { app } from '../../../api-app';
// Preserve opt-in consultation/provider gates. Never enable payments on this host.
const gateway = express();
gateway.disable('x-powered-by');
gateway.use('/autopilot-api', app);
gateway.listen(8000);
