// Username/password pilot. Requires migrations 005 + 006; deploy only after QA.
// Service-role credentials stay in Edge Functions environment, never the browser.
import { createClient } from 'npm:@supabase/supabase-js@2';
const ORIGIN='https://whadayalookinat.github.io';
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
function respond(status:number,body:Record<string,unknown>){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return respond(405,{error:'Method not allowed'});
 if(req.headers.get('origin')!==ORIGIN)return respond(403,{error:'Origin not allowed'});
 let payload:Record<string,unknown>;
 try{payload=await req.json();}catch{return respond(400,{error:'Invalid request'});}
 const username=String(payload.username??'').trim().toLowerCase();
 const password=typeof payload.password==='string'?payload.password:'';
 if(!/^[a-z0-9_]{3,30}$/.test(username)||!password||password.length>128)return respond(401,{error:'Invalid username or password'});
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!secret)return respond(500,{error:'Server configuration incomplete'});
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const reservation=crypto.randomUUID();
 const {data:admission,error:admissionError}=await admin.rpc('reserve_username_login',{p_username:username,p_reservation:reservation});
 if(admissionError||!admission?.length)return respond(503,{error:'Login temporarily unavailable'});
 if(!admission[0].admitted)return respond(429,{error:'Too many login attempts. Please try again shortly.'});
 try{
  const {data:profile,error:profileError}=await admin.from('league_members').select('user_id,is_active').eq('username',username).maybeSingle();
  if(profileError)return respond(503,{error:'Login temporarily unavailable'});
  if(!profile?.is_active)return respond(401,{error:'Invalid username or password'});
  const {data:limit,error:limitError}=await admin.rpc('login_limit_status',{p_user_id:profile.user_id});
  if(limitError||!limit?.length)return respond(503,{error:'Login temporarily unavailable'});
  if(!limit[0].allowed)return respond(429,{error:'Too many login attempts. Please try again shortly.'});
  const {data:authUser,error:userError}=await admin.auth.admin.getUserById(profile.user_id);
  if(userError||!authUser.user?.email)return respond(401,{error:'Invalid username or password'});
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:session,error:signInError}=await client.auth.signInWithPassword({email:authUser.user.email,password});
  if(signInError||!session.session){
   const {error:failureError}=await admin.rpc('record_login_failure',{p_user_id:profile.user_id});
   if(failureError)return respond(503,{error:'Login temporarily unavailable'});
   return respond(401,{error:'Invalid username or password'});
  }
  const {error:clearError}=await admin.rpc('clear_login_failures',{p_user_id:profile.user_id});
  if(clearError)return respond(503,{error:'Login temporarily unavailable'});
  return respond(200,{access_token:session.session.access_token,refresh_token:session.session.refresh_token});
 }finally{
  // If the function crashes, reservation expires after 20 seconds.
  const {error:releaseError}=await admin.rpc('release_username_login',{p_username:username,p_reservation:reservation});
  if(releaseError)console.error('Login reservation release failed');
 }
});
