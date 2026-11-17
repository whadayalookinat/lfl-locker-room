import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
const db=createClient('https://icnlonhemxftaooewzym.supabase.co','sb_publishable_1TqeS-KQz4IF02fSHgpC-Q_gcHdqKim');
const $=id=>document.getElementById(id);
const status=$('status'),login=$('login'),editor=$('editor'),members=$('members');
function note(s,error=false){status.textContent=s;status.classList.toggle('error',error);}
function showLogin(s='Please sign in as commissioner.'){editor.classList.add('hidden');login.classList.remove('hidden');note(s);}
async function load(){
 members.replaceChildren();
 const [profiles,assignments]=await Promise.all([
  db.from('league_members').select('user_id,username,display_name,is_active').order('username'),
  db.from('member_season_teams').select('user_id,team_name').eq('season',2026)
 ]);
 if(profiles.error||assignments.error){note('Unable to load roster: '+(profiles.error?.message||assignments.error?.message),true);return;}
 const byId=new Map((assignments.data||[]).map(a=>[a.user_id,a.team_name]));
 for(const m of profiles.data){
  const form=document.createElement('form');form.className='member';
  const title=document.createElement('strong');title.textContent=m.display_name+' ('+m.username+')'+(m.is_active?'':' — inactive');
  const label=document.createElement('label');label.textContent='2026 NFL team';
  const input=document.createElement('input');input.value=byId.get(m.user_id)||'';input.maxLength=50;input.placeholder='e.g., Green Bay Packers';
  const button=document.createElement('button');button.type='submit';button.textContent='Save 2026 assignment';
  form.append(title,label,input,button);
  form.addEventListener('submit',async e=>{
   e.preventDefault();const team=input.value.trim();button.disabled=true;
   let result;
   if(team){result=await db.from('member_season_teams').upsert({user_id:m.user_id,season:2026,team_name:team},{onConflict:'user_id,season'}).select('user_id');}
   else{result=await db.from('member_season_teams').delete().eq('user_id',m.user_id).eq('season',2026).select('user_id');}
   button.disabled=false;
   if(result.error){note('Save failed: '+result.error.message,true);return;}
   if(team&&!result.data?.length){note('No assignment saved; check permissions.',true);return;}
   note(team?'Saved '+m.username+' → '+team+' for 2026.':'Cleared 2026 assignment for '+m.username+'.');
   await load();
  });
  members.append(form);
 }
}
async function refresh(){
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user){showLogin();return;}
 const r=await db.from('league_members').select('is_active,is_commissioner').eq('user_id',user.id).maybeSingle();
 if(r.error||!r.data?.is_active||!r.data?.is_commissioner){showLogin('Commissioner access required.');return;}
 login.classList.add('hidden');editor.classList.remove('hidden');note('Commissioner access confirmed.');await load();
}
$('login-form').addEventListener('submit',async e=>{e.preventDefault();note('Signing in…');const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';if(error){note('Login failed: '+error.message,true);return;}await refresh();});
$('logout').addEventListener('click',async()=>{const {error}=await db.auth.signOut();if(error)note('Logout failed: '+error.message,true);else showLogin('Logged out.');});
refresh().catch(e=>note('Connection error: '+e.message,true));
