// Username/password login pilot. Deploy only after server-side rate limiting is configured.
// Never expose the service-role credential in browser code.
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
 const {data:profile,error:profileError}=await admin.from('league_members').select('user_id,is_active').eq('username',username).maybeSingle();
 if(profileError)return respond(500,{error:'Unable to sign in'});
 if(!profile?.is_active)return respond(401,{error:'Invalid username or password'});
 const {data:authUser,error:userError}=await admin.auth.admin.getUserById(profile.user_id);
 if(userError||!authUser.user?.email)return respond(401,{error:'Invalid username or password'});
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:session,error:signInError}=await client.auth.signInWithPassword({email:authUser.user.email,password});
 if(signInError||!session.session)return respond(401,{error:'Invalid username or password'});
 return respond(200,{access_token:session.session.access_token,refresh_token:session.session.refresh_token});
});
