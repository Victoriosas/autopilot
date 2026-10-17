import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'express';
function options(token?:string){return {auth:{persistSession:false,autoRefreshToken:false},...(token?{global:{headers:{Authorization:`Bearer ${token}`}}}:{})};}
export function beautyCallerDatabase(token?:string){
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('BEAUTY_UNAVAILABLE');
 return createClient(url,key,options(token));
}
export function beautyServerDatabase(){
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('BEAUTY_UNAVAILABLE');return createClient(url,key,options());
}
export const requireBeautyPractitioner:RequestHandler=async(req,res,next)=>{
 const token=req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
 if(!token)return res.status(401).json({error:'BEAUTY_AUTH_REQUIRED'});
 try{
  const db=beautyCallerDatabase(token),user=await db.auth.getUser(token);
  if(user.error||!user.data.user)return res.status(401).json({error:'BEAUTY_AUTH_INVALID'});
  const member=await db.from('beauty_practitioners').select('user_id').eq('user_id',user.data.user.id).eq('active',true).maybeSingle();
  if(member.error||!member.data)return res.status(403).json({error:'BEAUTY_PRACTITIONER_REQUIRED'});
  res.locals.beautyPractitionerId=user.data.user.id;return next();
 }catch{return res.status(503).json({error:'BEAUTY_UNAVAILABLE'});}
};
