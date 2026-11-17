import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
const URL='https://icnlonhemxftaooewzym.supabase.co';
const KEY='sb_publishable_1TqeS-KQz4IF02fSHgpC-Q_gcHdqKim';
const db=createClient(URL,KEY);
const $=id=>document.getElementById(id);
let profile=null,user=null;
for(let n=1;n<=18;n++){const option=document.createElement('option');option.value=String(n);option.textContent='Week '+n;$('week').append(option);}
$('week').value='11';
function note(s,error=false){$('status').textContent=s;$('status').classList.toggle('error',error);}
function showLogin(s='Please sign in.'){profile=null;user=null;$('login-view').classList.remove('hidden');$('member-view').classList.add('hidden');note(s);}
async function loadComments(){
 $('messages').replaceChildren();
 const {data,error}=await db.from('comments').select('id,author_id,body,created_at').eq('season',2026).eq('week',Number($('week').value)).order('created_at',{ascending:true});
 if(error){note('Could not load comments: '+error.message,true);return;}
 if(!data.length){const p=document.createElement('p');p.className='empty';p.textContent='No comments yet for this week.';$('messages').append(p);return;}
 const ids=[...new Set(data.map(c=>c.author_id))];
 const {data:members,error:memberError}=await db.from('league_members').select('user_id,display_name').in('user_id',ids);
 if(memberError){note('Could not load author names: '+memberError.message,true);return;}
 const names=new Map((members||[]).map(m=>[m.user_id,m.display_name]));
 for(const c of data){
  const article=document.createElement('article');article.className='message';
  const meta=document.createElement('div');meta.className='meta';
  const author=document.createElement('strong');author.textContent=names.get(c.author_id)||'Former member';
  const time=document.createElement('span');time.className='time';time.textContent=new Date(c.created_at).toLocaleString();
  meta.append(author,time);const body=document.createElement('p');body.textContent=c.body;article.append(meta,body);
  if(profile.is_commissioner){const controls=document.createElement('div');controls.className='comment-actions';const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Delete';remove.addEventListener('click',async()=>{if(!confirm('Delete this comment?'))return;remove.disabled=true;const {error}=await db.from('comments').delete().eq('id',c.id);if(error){note('Delete failed: '+error.message,true);remove.disabled=false;}else{note('Comment deleted.');await loadComments();}});controls.append(remove);article.append(controls);}
  $('messages').append(article);
 }
}
async function refresh(){
 const {data:{user:identity},error}=await db.auth.getUser();
 if(error||!identity){showLogin();return;}
 const result=await db.from('league_members').select('user_id,username,display_name,is_active,is_commissioner').eq('user_id',identity.id).maybeSingle();
 if(result.error||!result.data?.is_active){await db.auth.signOut();showLogin('Active membership required.');return;}
 user=identity;profile=result.data;
 $('display-name').textContent=profile.display_name;
 $('member-details').textContent='Signed in as '+profile.username+(profile.is_commissioner?' (commissioner)':'')+'.';
 $('commissioner-nav').classList.toggle('hidden',!profile.is_commissioner);
 $('login-view').classList.add('hidden');$('member-view').classList.remove('hidden');
 note('Signed in successfully.');await loadComments();
}
$('login-form').addEventListener('submit',async e=>{
 e.preventDefault();const button=$('login-button');button.disabled=true;note('Signing in…');
 try{
  const response=await fetch(URL+'/functions/v1/username-login',{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({username:$('username').value.trim().toLowerCase(),password:$('password').value}),signal:AbortSignal.timeout(55000)});
  $('password').value='';
  const body=await response.json().catch(()=>({}));
  if(!response.ok){note(response.status===429?'Too many login attempts. Please wait.':body.error||'Sign-in failed.',true);return;}
  if(!body.access_token||!body.refresh_token)throw new Error('No session returned');
  const {error}=await db.auth.setSession({access_token:body.access_token,refresh_token:body.refresh_token});
  if(error)throw error;
  await refresh();
 }catch(error){$('password').value='';note('Sign-in unavailable: '+(error?.message||'Network error'),true);}
 finally{button.disabled=false;}
});
$('logout').addEventListener('click',async()=>{const {error}=await db.auth.signOut();if(error)note('Logout failed: '+error.message,true);else showLogin('Logged out.');});
$('week').addEventListener('change',()=>{if(profile)loadComments();});
$('comment').addEventListener('input',()=>{$('remaining').textContent=(280-$('comment').value.length)+' characters remaining';});
$('comment-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!profile||!user)return;const body=$('comment').value.trim();if(!body||body.length>280)return;
 const button=$('post-button');button.disabled=true;
 const {error}=await db.from('comments').insert({author_id:user.id,season:2026,week:Number($('week').value),body});
 button.disabled=false;if(error){note('Post failed: '+error.message,true);return;}
 $('comment').value='';$('remaining').textContent='280 characters remaining';note('Comment posted.');await loadComments();
});
refresh().catch(()=>showLogin('Could not verify saved session.'));
