import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const INTERESTS=new Set(['general','facial_accessories','makeup_organization','reusable_care','body_care']);

function client(){
  const url=process.env.SUPABASE_URL?.trim();
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!url||!key) return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export function createStorefrontWaitlistRouter(){
  const router=Router();
  router.post('/',async(req,res)=>{
    const website=typeof req.body?.website==='string'?req.body.website.trim():'';
    if(website) return res.status(202).json({ok:true});
    const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
    const rawInterest=typeof req.body?.interest==='string'?req.body.interest:'general';
    const interest=INTERESTS.has(rawInterest)?rawInterest:'general';
    const consent=req.body?.consent===true;
    if(!EMAIL.test(email)||email.length>254) return res.status(400).json({error:'WAITLIST_EMAIL_INVALID'});
    if(!consent) return res.status(400).json({error:'WAITLIST_CONSENT_REQUIRED'});
    const db=client();
    if(!db) return res.status(503).json({error:'WAITLIST_UNAVAILABLE'});
    const source=typeof req.body?.source==='string'?req.body.source.replace(/[^a-zA-Z0-9_./-]/g,'').slice(0,80)||'storefront':'storefront';
    try{
      const {error}=await db.from('storefront_waitlist').upsert({
        email,interest,source,consent_launch_updates:true,updated_at:new Date().toISOString(),
      },{onConflict:'email'});
      if(error){console.error('Waitlist write failed:',error.code);return res.status(503).json({error:'WAITLIST_UNAVAILABLE'});}
      return res.status(202).json({ok:true});
    }catch{
      return res.status(503).json({error:'WAITLIST_UNAVAILABLE'});
    }
  });
  return router;
}
