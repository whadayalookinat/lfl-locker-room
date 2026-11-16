import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';

const supabase = createClient('https://icnlonhemxftaooewzym.supabase.co', 'sb_publishable_1TqeS-KQz4IF02fSHgpC-Q_gcHdqKim');
const $ = id => document.getElementById(id);
const loginView=$('login-view'), memberView=$('member-view'), status=$('status'), feed=$('messages');
let profile=null, currentUser=null;
const week=$('week');
for(let n=1;n<=18;n++){const option=document.createElement('option');option.value=String(n);option.textContent='Week '+n;week.append(option);}
week.value='11';
function showStatus(message,error=false){status.textContent=message;status.classList.toggle('error',error);}
function showLogin(message='Please log in.'){profile=null;currentUser=null;loginView.classList.remove('hidden');memberView.classList.add('hidden');showStatus(message);}
async function loadComments(){
 feed.replaceChildren();
 const {data,error}=await supabase.from('comments').select('id,author_id,body,created_at').eq('season',2026).eq('week',Number(week.value)).order('created_at',{ascending:true});
 if(error){showStatus('Could not load comments: '+error.message,true);return;}
 if(!data.length){const p=document.createElement('p');p.className='empty';p.textContent='No comments yet for this week.';feed.append(p);return;}
 const ids=[...new Set(data.map(c=>c.author_id))];
 const {data:members,error:memberError}=await supabase.from('league_members').select('user_id,display_name').in('user_id',ids);
 if(memberError){showStatus('Could not load author names: '+memberError.message,true);return;}
 const names=new Map((members||[]).map(m=>[m.user_id,m.display_name]));
 for(const item of data){
  const article=document.createElement('article');article.className='message';
  const meta=document.createElement('div');meta.className='meta';
  const author=document.createElement('strong');author.textContent=names.get(item.author_id)||'Former member';
  const time=document.createElement('span');time.className='time';time.textContent=new Date(item.created_at).toLocaleString();
  meta.append(author,time);
  const p=document.createElement('p');p.textContent=item.body;article.append(meta,p);
  if(profile.is_commissioner){const controls=document.createElement('div');controls.className='comment-actions';const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Delete';remove.addEventListener('click',async()=>{if(!confirm('Delete this comment?'))return;remove.disabled=true;const {error}=await supabase.from('comments').delete().eq('id',item.id);if(error){showStatus('Delete failed: '+error.message,true);remove.disabled=false;}else{showStatus('Comment deleted.');await loadComments();}});controls.append(remove);article.append(controls);}
  feed.append(article);
 }
}
async function refreshAuth(){
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user){showLogin();return;}
 const result=await supabase.from('league_members').select('user_id,username,display_name,is_active,is_commissioner').eq('user_id',user.id).maybeSingle();
 if(result.error){showLogin('Unable to verify membership: '+result.error.message);return;}
 if(!result.data||!result.data.is_active){await supabase.auth.signOut();showLogin('This account is not an active Locker Room member.');return;}
 currentUser=user;profile=result.data;
 loginView.classList.add('hidden');memberView.classList.remove('hidden');$('display-name').textContent=profile.display_name;
 showStatus('Authenticated as '+profile.username+(profile.is_commissioner?' (commissioner)':'')+'.');
 await loadComments();
}
$('login-form').addEventListener('submit',async event=>{event.preventDefault();const button=$('login-button');button.disabled=true;showStatus('Signing in…');const {error}=await supabase.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';button.disabled=false;if(error){showStatus('Login failed: '+error.message,true);return;}await refreshAuth();});
$('logout').addEventListener('click',async()=>{const {error}=await supabase.auth.signOut();if(error)showStatus('Logout failed: '+error.message,true);else showLogin('Logged out.');});
week.addEventListener('change',()=>{if(profile)loadComments();});
$('comment').addEventListener('input',()=>{$('remaining').textContent=(280-$('comment').value.length)+' characters remaining';});
$('comment-form').addEventListener('submit',async event=>{event.preventDefault();if(!currentUser||!profile)return;const body=$('comment').value.trim();if(!body||body.length>280)return;const button=$('post-button');button.disabled=true;const {error}=await supabase.from('comments').insert({author_id:currentUser.id,season:2026,week:Number(week.value),body});button.disabled=false;if(error){showStatus('Post failed: '+error.message,true);return;}$('comment').value='';$('remaining').textContent='280 characters remaining';showStatus('Comment posted and saved.');await loadComments();});
refreshAuth().catch(e=>showStatus('Connection error: '+e.message,true));
