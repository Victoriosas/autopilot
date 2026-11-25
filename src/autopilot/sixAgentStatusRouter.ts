import {Router} from 'express';
import {requireSupabaseAdminAuth} from '../security/adminAuth';
import {readCloudStatus, type CloudStatus} from './cloudStatusReader';

export function createSixAgentStatusRouter(reader:()=>Promise<CloudStatus>=readCloudStatus) {
 const router=Router();
 router.use(requireSupabaseAdminAuth);
 // The previous implementation read all production task rows with a service key.
 // Only the explicit aggregate reader transport is permitted. Never fall back
 // to primary ledger rows or the application's service credential.
 router.get('/',async(_req,res)=>{
  res.setHeader('cache-control','no-store');
  try{res.json(await reader());}
  catch(error){res.status(503).json({error:error instanceof Error&&error.message==='DIRECTOR_SYNTHETIC_READER_NOT_CONFIGURED'
    ?error.message:'CLOUD_STATUS_UNAVAILABLE'});}
 });
 return router;
}
