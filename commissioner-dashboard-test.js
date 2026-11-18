import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
const URL='https://icnlonhemxftaooewzym.supabase.co',KEY='sb_publishable_1TqeS-KQz4IF02fSHgpC-Q_gcHdqKim';
const db=createClient(URL,KEY),$=id=>document.getElementById(id);
let current=null,members=[],teams=new Map();
function note(s,error=false){$('status').textContent=s;$('status').className='status '+(error?'error':'success');}
function field(label,value,max=50){const div=document.createElement('div'),l=document.createElement('label'),i=document.createElement('input');l.textContent=label;i.value=value??'';i.maxLength=max;i.required=label==='Username'||label==='Display name';div.append(l,i);return {div,i};}
function option(select,value,text){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}
async function callFunction(name,payload){const {data:{session},error}=await db.auth.getSession();if(error||!session?.access_token)throw Error('Session expired. Sign in again.');const res=await fetch(URL+'/functions/v1/'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:'Bearer '+session.access_token},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});const body=await res.json().catch(()=>({}));if(!res.ok)throw Error((body.error||'Request failed')+' (HTTP '+res.status+')');return body;}
async function load(){
 const [a,b]=await Promise.all([db.from('league_members').select('user_id,username,display_name,first_name,is_active,is_commissioner').order('username'),db.from('member_season_teams').select('user_id,team_name').eq('season',2026)]);
 if(a.error||b.error)throw Error(a.error?.message||b.error?.message);
 members=a.data||[];teams=new Map((b.data||[]).map(x=>[x.user_id,x.team_name]));
 render();
}
function render(){
 const profiles=$('profile-list'),teamList=$('team-list'),reset=$('reset-user');profiles.replaceChildren();teamList.replaceChildren();reset.replaceChildren();option(reset,'','Select participant');
 for(const m of members){
  if(!m.is_commissioner)option(reset,m.user_id,m.display_name+' ('+m.username+')');
  const form=document.createElement('form');form.className='member';
  const heading=document.createElement('h3');heading.textContent=m.display_name+' ('+m.username+')';
  const grid=document.createElement('div');grid.className='fields';
  const username=field('Username',m.username,30),display=field('Display name',m.display_name),first=field('First name',m.first_name);
  for(const f of [username,display,first])grid.append(f.div);
  const activeLabel=document.createElement('label');activeLabel.className='check';const active=document.createElement('input');active.type='checkbox';active.checked=m.is_active;
  if(m.is_commissioner)active.disabled=true;
  activeLabel.append(active,document.createTextNode(' Account active'));
  const role=document.createElement('p');role.className='muted';role.textContent=m.is_commissioner?'Commissioner (role cannot be edited here)':'Participant';
  const save=document.createElement('button');save.type='submit';save.textContent='Save profile';
  form.append(heading,grid,activeLabel,role,save);
  form.addEventListener('submit',async e=>{e.preventDefault();const changes={username:username.i.value.trim().toLowerCase(),display_name:display.i.value.trim(),first_name:first.i.value.trim()||null,is_active:m.is_commissioner?m.is_active:active.checked};
   if(!/^[a-z0-9_]{3,30}$/.test(changes.username)||!changes.display_name||changes.display_name.length>50){note('Check username and display name formatting.',true);return;}
   if(!confirm('Save profile changes for '+m.username+'?'))return;
   save.disabled=true;try{const {data,error}=await db.from('league_members').update(changes).eq('user_id',m.user_id).select('user_id');if(error)throw error;if(!data?.length)throw Error('No row updated');note('Saved '+changes.username+'.');await load();}catch(err){note('Profile save failed: '+err.message,true);}finally{save.disabled=false;}
  });profiles.append(form);
  const teamForm=document.createElement('form');teamForm.className='member';const title=document.createElement('h3');title.textContent=m.display_name+' ('+m.username+')';const label=document.createElement('label');label.textContent='2026 NFL team';const input=document.createElement('input');input.maxLength=50;input.value=teams.get(m.user_id)||'';input.placeholder='e.g., Green Bay Packers';const button=document.createElement('button');button.type='submit';button.textContent='Save team';teamForm.append(title,label,input,button);
  teamForm.addEventListener('submit',async e=>{e.preventDefault();const team=input.value.trim();if(!confirm((team?'Save '+team:'Clear team assignment')+' for '+m.username+' in 2026?'))return;button.disabled=true;try{const result=team?await db.from('member_season_teams').upsert({user_id:m.user_id,season:2026,team_name:team},{onConflict:'user_id,season'}).select('user_id'):await db.from('member_season_teams').delete().eq('user_id',m.user_id).eq('season',2026).select('user_id');if(result.error)throw result.error;if(team&&!result.data?.length)throw Error('No row saved');note('2026 assignment '+(team?'saved':'cleared')+' for '+m.username+'.');await load();}catch(err){note('Team save failed: '+err.message,true);}finally{button.disabled=false;}});
  teamList.append(teamForm);
 }
}
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{const tab=button.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===button)));for(const id of ['profiles','teams','passwords','create'])$(id).classList.toggle('hidden',id!==tab);}));
$('reset-form').addEventListener('submit',async e=>{e.preventDefault();const id=$('reset-user').value,password=$('reset-password').value;if(!id||password!==$('reset-confirm').value||password.length<12||password.length>128){note('Select a participant and enter matching 12–128 character passwords.',true);return;}const member=members.find(x=>x.user_id===id);if(!member||member.is_commissioner)return;if(!confirm('Reset password for '+member.username+'?'))return;const button=$('reset-button');button.disabled=true;try{await callFunction('commissioner-reset-password',{user_id:id,new_password:password});$('reset-password').value='';$('reset-confirm').value='';note('Password reset succeeded for '+member.username+'. Existing sessions may remain active.');}catch(err){note('Password reset failed: '+err.message,true);}finally{button.disabled=false;}});
$('create-form').addEventListener('submit',async e=>{e.preventDefault();const username=$('new-username').value.trim().toLowerCase(),display_name=$('new-display').value.trim(),first_name=$('new-first').value.trim(),password=$('new-password').value;if(!/^[a-z0-9_]{3,30}$/.test(username)||!display_name||display_name.length>50||first_name.length>50||password.length<12||password.length>128||password!==$('new-confirm').value){note('Check username, names and matching 12–128 character passwords.',true);return;}if(!confirm('Create a new active participant account for '+username+'? This is a real Auth account, not a preview.'))return;const button=$('create-button');button.disabled=true;try{await callFunction('commissioner-create-member',{username,display_name,first_name,password});$('create-form').reset();note('Created participant '+username+'. Assign a 2026 team separately.');await load();}catch(err){note('Account creation failed: '+err.message,true);}finally{button.disabled=false;}});
async function init(){const {data:{user},error}=await db.auth.getUser();if(error||!user){note('Sign in as doug on the username-login test page first.',true);return;}const {data:member,error:memberError}=await db.from('league_members').select('username,is_active,is_commissioner').eq('user_id',user.id).maybeSingle();if(memberError||!member?.is_active||!member.is_commissioner){note('Commissioner access required. Sign in as doug.',true);return;}current=user;$('identity').textContent='Signed in as '+member.username+' (commissioner).';$('dashboard').classList.remove('hidden');await load();note('Commissioner dashboard ready.');}
init().catch(err=>note('Unable to load dashboard: '+err.message,true));
