import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
const supabase=createClient('https://icnlonhemxftaooewzym.supabase.co','sb_publishable_1TqeS-KQz4IF02fSHgpC-Q_gcHdqKim');
const $=id=>document.getElementById(id);
const status=$('status'),login=$('login-view'),admin=$('admin-view'),members=$('members');
let commissionerId=null;
function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
function showLogin(text='Please sign in as commissioner.'){commissionerId=null;admin.classList.add('hidden');login.classList.remove('hidden');message(text);}
function field(label,value,maxLength=50){const wrap=document.createElement('div');const lbl=document.createElement('label');lbl.textContent=label;const input=document.createElement('input');input.value=value??'';input.maxLength=maxLength;input.required=label==='Username'||label==='Display name';wrap.append(lbl,input);return {wrap,input};}
async function loadMembers(){
 members.replaceChildren();
 const {data,error}=await supabase.from('league_members').select('user_id,username,display_name,first_name,team_name,is_active,is_commissioner').order('username');
 if(error){message('Cannot load members: '+error.message,true);return;}
 for(const member of data){
  const form=document.createElement('form');form.className='member';
  const title=document.createElement('h3');title.textContent=member.display_name+' ('+member.username+')';
  const fields=document.createElement('div');fields.className='fields';
  const username=field('Username',member.username,30),display=field('Display name',member.display_name),first=field('First name',member.first_name),team=field('NFL team',member.team_name);
  for(const f of [username,display,first,team])fields.append(f.wrap);
  const check=document.createElement('label');check.className='check';
  const active=document.createElement('input');active.type='checkbox';active.checked=member.is_active;
  const checkText=document.createElement('span');checkText.textContent='Account active';check.append(active,checkText);
  if(member.user_id===commissionerId){active.disabled=true;const note=document.createElement('p');note.className='muted';note.textContent='Your own active status is locked on this test page.';form.append(title,fields,check,note);}
  else form.append(title,fields,check);
  const role=document.createElement('p');role.className='muted';role.textContent=member.is_commissioner?'Role: Commissioner':'Role: Participant';
  const save=document.createElement('button');save.type='submit';save.textContent='Save profile';
  form.append(role,save);
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const changes={username:username.input.value.trim().toLowerCase(),display_name:display.input.value.trim(),first_name:first.input.value.trim()||null,team_name:team.input.value.trim()||null,is_active:active.checked};
   if(!/^[a-z0-9_]{3,30}$/.test(changes.username)){message('Username must be 3–30 lowercase letters, numbers, or underscores.',true);return;}
   if(!changes.display_name||changes.display_name.length>50){message('Display name must be 1–50 characters.',true);return;}
   if(member.user_id===commissionerId)changes.is_active=true;
   save.disabled=true;
   const {data:updated,error}=await supabase.from('league_members').update(changes).eq('user_id',member.user_id).select('user_id');
   save.disabled=false;
   if(error){message('Save failed: '+error.message,true);return;}
   if(!updated?.length){message('No profile updated. Check permissions.',true);return;}
   message('Saved '+changes.username+'.');await loadMembers();
  });
  members.append(form);
 }
 if(!data.length)message('No members found.');
}
async function refresh(){
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user){showLogin();return;}
 const result=await supabase.from('league_members').select('is_active,is_commissioner').eq('user_id',user.id).maybeSingle();
 if(result.error||!result.data?.is_active||!result.data?.is_commissioner){showLogin('This page is restricted to the commissioner.');return;}
 commissionerId=user.id;login.classList.add('hidden');admin.classList.remove('hidden');message('Commissioner access confirmed.');await loadMembers();
}
$('login-form').addEventListener('submit',async event=>{event.preventDefault();const button=$('login-button');button.disabled=true;message('Signing in…');const {error}=await supabase.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';button.disabled=false;if(error){message('Login failed: '+error.message,true);return;}await refresh();});
$('logout').addEventListener('click',async()=>{const {error}=await supabase.auth.signOut();if(error)message('Logout failed: '+error.message,true);else showLogin('Logged out.');});
refresh().catch(error=>message('Connection error: '+error.message,true));
