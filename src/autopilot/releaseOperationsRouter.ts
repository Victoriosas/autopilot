import { Router } from 'express';
import { requireSupabaseAdminAuth } from '../security/adminAuth';
import { getPersistedProductDraft, publishProductDraftAtomically } from './draftStore';

export function createReleaseOperationsRouter(): Router {
  const router=Router();
  router.use(requireSupabaseAdminAuth);

  router.post('/publish',async(req,res)=>{
    const draftId=typeof req.body?.draftId==='string'?req.body.draftId.trim():'';
    if(!/^[0-9a-f-]{36}$/i.test(draftId)) return res.status(400).json({error:'VALID_DRAFT_ID_REQUIRED'});
    try{
      const draft=await getPersistedProductDraft(draftId);
      if(draft.createdInShadowMode || !draft.publicationEligible) {
        return res.status(409).json({error:'SHADOW_PUBLICATION_DENIED'});
      }
      if(draft.status!=='ai_approved'&&draft.status!=='published') {
        return res.status(409).json({error:'PRODUCTION_READY_DRAFT_REQUIRED',status:draft.status});
      }
      const published=await publishProductDraftAtomically(draftId);
      return res.json({
        success:true,
        draft:published,
        product:{id:published.publishedProductId,status:'published'},
        safety:{manualAdminRelease:true,supplierPurchaseTriggered:false,paymentTriggered:false,checkoutChanged:false},
      });
    }catch(error:any){
      const code=String(error?.message||'MANUAL_RELEASE_FAILED');
      const known=['MANUAL_RELEASE_EVIDENCE_STALE_OR_INVALID','PRODUCTION_READY_COUNCIL_REQUIRED','COUNCIL_APPROVAL_REQUIRED','SHADOW_PUBLICATION_DENIED'];
      const publicCode=known.find(value=>code.includes(value))||'MANUAL_RELEASE_FAILED';
      return res.status(publicCode==='MANUAL_RELEASE_FAILED'?500:409).json({error:publicCode});
    }
  });

  return router;
}
