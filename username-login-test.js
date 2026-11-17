import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
const URL='https://icnlonhemxftaooewzym.supabase.co';
const KEY='sb_publishable_1TqeS-KQz4IF02fSHgpC-Q_gcHdqKim';
const client=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id);
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function showLogin(message='Please log in.'){ $('login-view').classList.remove('hidden');$('member-view').classList.add('hidden');status(message); }
async function verifyMember(){
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user){showLogin();return;}
 const {data:profile,error:profileError}=await client.from('league_members').select('username,display_name,is_active,is_commissioner').eq('user_id',user.id).maybeSingle();
 if(profileError||!profile?.is_active){await client.auth.signOut();showLogin('This account is not an active Locker Room member.');return;}
 $('display-name').textContent=profile.display_name;
 $('member-details').textContent='Signed in as '+profile.username+(profile.is_commissioner?' (commissioner)':'')+'.';
 $('login-view').classList.add('hidden');$('member-view').classList.remove('hidden');
 status('Username login successful. Account membership verified.');
}
$('login-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=$('login-button');button.disabled=true;status('Signing in…');
 const username=$('username').value.trim().toLowerCase();
 const password=$('password').value;
 try{
  const response=await fetch(URL+'/functions/v1/username-login',{
   method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},
   body:JSON.stringify({username,password}),signal:AbortSignal.timeout(55000)
  });
  $('password').value='';
  const body=await response.json();
  if(!response.ok){status(response.status===429?'Too many attempts. Wait before trying again.':body.error||'Login failed.',true);return;}
  if(!body.access_token||!body.refresh_token)throw new Error('Missing session tokens');
  const {error}=await client.auth.setSession({access_token:body.access_token,refresh_token:body.refresh_token});
  if(error)throw error;
  await verifyMember();
 }catch(error){$('password').value='';status('Login unavailable: '+(error?.name==='TimeoutError'?'request timed out':error.message),true);}
 finally{button.disabled=false;}
});
$('logout').addEventListener('click',async()=>{const {error}=await client.auth.signOut();if(error)status('Logout failed: '+error.message,true);else showLogin('Logged out.');});
verifyMember().catch(()=>showLogin('Unable to verify current session.'));
