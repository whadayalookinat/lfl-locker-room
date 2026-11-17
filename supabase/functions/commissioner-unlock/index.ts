// Commissioner-only unlock. Requires migration 005; not deployed.
import { createClient } from 'npm:@supabase/supabase-js@2';
const ORIGIN='https://whadayalookinat.github.io';
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
 if(req.headers.get('origin')!==ORIGIN)return reply(403,{error:'Origin not allowed'});
 const token=req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return reply(401,{error:'Sign in required'});
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!secret)return reply(500,{error:'Server configuration incomplete'});
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:authError}=await client.auth.getUser(token);
 if(authError||!identity.user)return reply(401,{error:'Invalid session'});
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:caller,error:callerError}=await admin.from('league_members').select('is_active,is_commissioner').eq('user_id',identity.user.id).maybeSingle();
 if(callerError)return reply(500,{error:'Cannot verify permissions'});
 if(!caller?.is_active||!caller.is_commissioner)return reply(403,{error:'Commissioner access required'});
 let body:Record<string,unknown>;try{body=await req.json()}catch{return reply(400,{error:'Invalid request'})}
 const userId=body.user_id;
 if(typeof userId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))return reply(400,{error:'Invalid account ID'});
 const {data:target,error:targetError}=await admin.from('league_members').select('user_id,username,is_commissioner').eq('user_id',userId).maybeSingle();
 if(targetError)return reply(500,{error:'Could not verify participant'});
 if(!target)return reply(404,{error:'Participant not found'});
 if(target.is_commissioner)return reply(403,{error:'Commissioner account cannot be unlocked here'});
 const {error:clearError}=await admin.rpc('clear_login_failures',{p_user_id:userId});
 if(clearError)return reply(500,{error:'Unlock failed'});
 return reply(200,{username:target.username,unlocked:true});
});
