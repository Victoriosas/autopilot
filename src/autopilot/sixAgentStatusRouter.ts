import {Router} from 'express';
import {requireSupabaseAdminAuth} from '../security/adminAuth';

export function createSixAgentStatusRouter() {
 const router=Router();
 router.use(requireSupabaseAdminAuth);
 // The previous implementation read all production task rows with a service key.
 // Director metrics remain unavailable until a dedicated, reviewed synthetic-only
 // observer transport is configured; never fall back to the primary ledger.
 router.get('/',(_req,res)=>res.status(503).json({error:'DIRECTOR_SYNTHETIC_READER_NOT_CONFIGURED'}));
 return router;
}
