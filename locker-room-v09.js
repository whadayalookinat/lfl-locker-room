import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
const URL='https://icnlonhemxftaooewzym.supabase.co';
const KEY='sb_publishable_1TqeS-KQz4IF02fSHgpC-Q_gcHdqKim';
const db=createClient(URL,KEY);
const $=id=>document.getElementById(id);
let profile=null,user=null;

const TEAM_COLORS={
 'Arizona Cardinals':['#97233F','#FFB612','ARI'],
 'Atlanta Falcons':['#A71930','#000000','ATL'],
 'Baltimore Ravens':['#241773','#9E7C0C','BAL'],
 'Buffalo Bills':['#00338D','#C60C30','BUF'],
 'Carolina Panthers':['#0085CA','#101820','CAR'],
 'Chicago Bears':['#0B162A','#C83803','CHI'],
 'Cincinnati Bengals':['#FB4F14','#000000','CIN'],
 'Cleveland Browns':['#311D00','#FF3C00','CLE'],
 'Dallas Cowboys':['#003594','#869397','DAL'],
 'Denver Broncos':['#FB4F14','#002244','DEN'],
 'Detroit Lions':['#0076B6','#B0B7BC','DET'],
 'Green Bay Packers':['#203731','#FFB612','GB'],
 'Houston Texans':['#03202F','#A71930','HOU'],
 'Indianapolis Colts':['#002C5F','#A2AAAD','IND'],
 'Jacksonville Jaguars':['#006778','#D7A22A','JAX'],
 'Kansas City Chiefs':['#E31837','#FFB81C','KC'],
 'Las Vegas Raiders':['#000000','#A5ACAF','LV'],
 'Los Angeles Chargers':['#0080C6','#FFC20E','LAC'],
 'Los Angeles Rams':['#003594','#FFA300','LAR'],
 'Miami Dolphins':['#008E97','#FC4C02','MIA'],
 'Minnesota Vikings':['#4F2683','#FFC62F','MIN'],
 'New England Patriots':['#002244','#C60C30','NE'],
 'New Orleans Saints':['#101820','#D3BC8D','NO'],
 'New York Giants':['#0B2265','#A71930','NYG'],
 'New York Jets':['#125740','#000000','NYJ'],
 'Philadelphia Eagles':['#004C54','#A5ACAF','PHI'],
 'Pittsburgh Steelers':['#101820','#FFB612','PIT'],
 'San Francisco 49ers':['#AA0000','#B3995D','SF'],
 'Seattle Seahawks':['#002244','#69BE28','SEA'],
 'Tampa Bay Buccaneers':['#D50A0A','#FF7900','TB'],
 'Tennessee Titans':['#0C2340','#4B92DB','TEN'],
 'Washington Commanders':['#5A1414','#FFB612','WAS']
};
const TEAM_ALIASES={'LA Rams':'Los Angeles Rams','Oakland Raiders':'Las Vegas Raiders','Washington Football Team':'Washington Commanders','Washington Redskins':'Washington Commanders'};
function teamColors(name){return TEAM_COLORS[name]||TEAM_COLORS[TEAM_ALIASES[name]]||null;}

for(let n=1;n<=18;n++){const option=document.createElement('option');option.value=String(n);option.textContent='Week '+n;$('week').append(option);}
$('week').value='11';
function note(s,error=false){$('status').textContent=s;$('status').classList.toggle('error',error);$('status').classList.toggle('success',!error);}
function showLogin(s='Please sign in.'){profile=null;user=null;$('latest-link').classList.add('hidden');$('top-link').classList.add('hidden');$('login-view').classList.remove('hidden');$('member-view').classList.add('hidden');note(s);}
function jumpToLatest(){const last=$('messages').querySelector('.message:last-child');if(last)last.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
$('latest-link').addEventListener('click',e=>{e.preventDefault();jumpToLatest();});
async function loadComments(){
 $('latest-link').classList.add('hidden');$('top-link').classList.add('hidden');
 $('messages').replaceChildren();
 const {data,error}=await db.from('comments').select('id,author_id,body,created_at').eq('season',2026).eq('week',Number($('week').value)).order('created_at',{ascending:true});
 if(error){note('Could not load comments: '+error.message,true);return false;}
 if(!data.length){const p=document.createElement('p');p.className='empty';p.textContent='No comments yet for this week.';$('messages').append(p);return true;}
 const ids=[...new Set(data.map(c=>c.author_id))];
 const {data:members,error:memberError}=await db.from('league_members').select('user_id,display_name').in('user_id',ids);
 if(memberError){note('Could not load author names: '+memberError.message,true);return false;}
 const names=new Map((members||[]).map(m=>[m.user_id,m.display_name]));
 // Use the discussion season, not the member's latest assignment.
 const season=2026;
 const {data:assignments,error:teamError}=await db.from('member_season_teams').select('user_id,team_name').eq('season',season).in('user_id',ids);
 if(teamError){note('Could not load team colors: '+teamError.message,true);}
 const assignedTeams=new Map((assignments||[]).map(a=>[a.user_id,a.team_name]));
 for(const c of data){
  const article=document.createElement('article');article.className='message';
  const assigned=assignedTeams.get(c.author_id);
  const colors=teamColors(assigned);
  if(colors){article.style.setProperty('--team-primary',colors[0]);article.style.setProperty('--team-secondary',colors[1]);}
  const meta=document.createElement('div');meta.className='meta';
  const author=document.createElement('strong');author.textContent=names.get(c.author_id)||'Former member';
  const time=document.createElement('span');time.className='time';time.textContent=new Date(c.created_at).toLocaleString();
  meta.append(author);
  if(colors){const tag=document.createElement('span');tag.className='team-tag';tag.textContent=assigned;tag.title=assigned;tag.style.setProperty('--team-primary',colors[0]);tag.style.setProperty('--team-secondary',colors[1]);meta.append(tag);}
  meta.append(time);const body=document.createElement('p');body.textContent=c.body;article.append(meta,body);
  if(profile.is_commissioner){const controls=document.createElement('div');controls.className='comment-actions';const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Delete';remove.addEventListener('click',async()=>{if(!confirm('Delete this comment?'))return;remove.disabled=true;const {data:deleted,error}=await db.from('comments').delete().eq('id',c.id).select('id');if(error||deleted?.length!==1){note('Delete failed or not authorized: '+(error?.message||'No row deleted'),true);remove.disabled=false;}else{note('Comment deleted.');await loadComments();}});controls.append(remove);article.append(controls);}
  $('messages').append(article);
 }
 $('latest-link').classList.remove('hidden');$('top-link').classList.remove('hidden');
 return true;
}
async function refresh(){
 const {data:{user:identity},error}=await db.auth.getUser();
 if(error||!identity){showLogin();return;}
 const result=await db.from('league_members').select('user_id,username,display_name,is_active,is_commissioner').eq('user_id',identity.id).maybeSingle();
 if(result.error||!result.data?.is_active){await db.auth.signOut();showLogin('Active membership required.');return;}
 user=identity;profile=result.data;
 $('display-name').textContent=profile.display_name;
 $('member-details').textContent='Signed in as '+profile.username+(profile.is_commissioner?' (commissioner)':'')+'.';
 const {data:assignment,error:teamError}=await db.from('member_season_teams').select('team_name').eq('user_id',identity.id).eq('season',2026).maybeSingle();
 $('team-pill').textContent='2026 team: '+(teamError?'Unavailable':assignment?.team_name||'Unassigned');
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
$('refresh-comments').addEventListener('click',async()=>{
 if(!profile)return;
 const button=$('refresh-comments'),feedback=$('refresh-feedback');
 button.disabled=true;button.textContent='Refreshing…';feedback.textContent='';
 try{
  const ok=await loadComments();
  feedback.textContent=ok?'Comments updated.':'Could not refresh comments. Try again.';
 }catch(error){
  feedback.textContent='Could not refresh comments. Try again.';
  note('Could not refresh comments: '+(error?.message||'Unknown error'),true);
 }finally{
  button.textContent='↻ Refresh comments';button.disabled=false;
 }
});
$('week').addEventListener('change',()=>{if(profile){$('refresh-feedback').textContent='';loadComments();}});
$('comment').addEventListener('input',()=>{$('remaining').textContent=(280-$('comment').value.length)+' characters remaining';});
$('comment-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!profile||!user)return;const body=$('comment').value.trim();if(!body||body.length>280)return;
 const button=$('post-button');button.disabled=true;
 const {error}=await db.from('comments').insert({author_id:user.id,season:2026,week:Number($('week').value),body});
 button.disabled=false;if(error){note('Post failed: '+error.message,true);return;}
 $('comment').value='';$('remaining').textContent='280 characters remaining';note('Comment posted.');await loadComments();jumpToLatest();
});
refresh().catch(()=>showLogin('Could not verify saved session.'));
