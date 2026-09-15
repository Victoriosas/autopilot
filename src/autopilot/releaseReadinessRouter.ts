import { Router } from 'express';
import { requireSupabaseAdminAuth } from '../security/adminAuth';
import { computeReleaseReadiness } from './releaseReadiness';

export function createReleaseReadinessRouter():Router{
  const router=Router();
  router.get('/',requireSupabaseAdminAuth,async(_req,res)=>{
    try{
      return res.json(await computeReleaseReadiness());
    }catch(error:any){
      console.error('Release readiness unavailable:',error?.message||error);
      return res.status(503).json({error:'RELEASE_READINESS_UNAVAILABLE'});
    }
  });
  return router;
}
