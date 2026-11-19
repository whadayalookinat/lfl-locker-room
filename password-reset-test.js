import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
const URL='https://icnlonhemxftaooewzym.supabase.co';
const KEY='sb_publishable_1TqeS-KQz4IF02fSHgpC-Q_gcHdqKim';
const client=createClient(URL,KEY);
const $=id=>document.getElementById(id);
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
let targetId=null;
async function initialize(){
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user){status('Sign in with a commissioner account on the username-login page, then return here.',true);return;}
 const {data:me,error:meError}=await client.from('league_members').select('username,is_active,is_commissioner').eq('user_id',user.id).maybeSingle();
 if(meError||!me?.is_active||!me.is_commissioner){status('Commissioner access required.',true);return;}
 const {data:target,error:targetError}=await client.from('league_members').select('user_id,username,is_commissioner').eq('username','testplayer2').maybeSingle();
 if(targetError||!target||target.is_commissioner){status('Test participant not found or is not eligible for reset.',true);return;}
 targetId=target.user_id;
 $('commissioner').textContent=me.username;
 $('ready').classList.remove('hidden');
 status('Commissioner verified. Ready to reset testplayer2.');
}
$('reset-form').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!targetId)return;
 const password=$('password').value,confirmPassword=$('confirm').value;
 if(password.length<12||password.length>128||password!==confirmPassword){status('Passwords must match and be 12–128 characters.',true);return;}
 if(!window.confirm('Reset the password for testplayer2?'))return;
 const button=$('reset-button');button.disabled=true;status('Resetting testplayer2 password…');
 try{
  const {data:{session},error:sessionError}=await client.auth.getSession();
  if(sessionError||!session?.access_token)throw new Error('Commissioner session expired. Sign in again.');
  const response=await fetch(URL+'/functions/v1/commissioner-reset-password',{
   method:'POST',headers:{'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+session.access_token},
   body:JSON.stringify({user_id:targetId,new_password:password}),signal:AbortSignal.timeout(30000)
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('Reset failed (HTTP '+response.status+'): '+(body.error||'Check function configuration.'));
  $('password').value='';$('confirm').value='';
  status('Password reset successful for testplayer2. Log out as doug, then test the new password.');
 }catch(error){status(error.message||'Password reset failed.',true);}
 finally{button.disabled=false;}
});
initialize().catch(()=>status('Unable to check commissioner session.',true));
