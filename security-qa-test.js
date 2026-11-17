import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
const db=createClient('https://icnlonhemxftaooewzym.supabase.co','sb_publishable_1TqeS-KQz4IF02fSHgpC-Q_gcHdqKim');
const $=id=>document.getElementById(id);
const PREFIX='[LFL-RLS-QA-v1] ';
let me=null,profile=null,record=null,other=null,busy=false;
function note(s,kind=''){const el=$('status');el.textContent=s;el.className='status '+kind;}
function buttons(){const has=!!record;$('create').disabled=busy||has;$('attempt').disabled=busy||!has;$('verify').disabled=busy||!has;$('copy').disabled=!has;$('inspect').disabled=busy||!profile?.is_commissioner;$('delete-other').disabled=busy||!other;}
function display(state){$('record-id').textContent=record?.id??'None';$('record-owner').textContent=profile?.username??'—';$('record-state').textContent=state;buttons();}
async function readRecord(id){const {data,error}=await db.from('comments').select('id,author_id,season,week,body').eq('id',id).maybeSingle();if(error)throw error;return data;}
async function withBusy(fn){if(busy)return;busy=true;buttons();try{await fn();}catch(e){note('Test error: '+(e?.message||'Unknown error'),'error');}finally{busy=false;buttons();}}
$('create').addEventListener('click',()=>withBusy(async()=>{
 if(record)return;
 const marker=PREFIX+crypto.randomUUID();
 const {data,error}=await db.from('comments').insert({author_id:me.id,season:2026,week:18,body:marker}).select('id,author_id,season,week,body').single();
 if(error)throw error;
 record=data;display('Created; not yet tested');note('Disposable comment created. ID '+record.id+'. Now attempt DELETE.');
}));
$('attempt').addEventListener('click',()=>withBusy(async()=>{
 if(!record)return;
 if(!confirm('Attempt DELETE of QA-only record #'+record.id+' as '+profile.username+'?'))return;
 const id=record.id;
 const {data,error}=await db.from('comments').delete().eq('id',id).select('id');
 if(error){note('DELETE returned error: '+error.message+'. Verifying record…','warn');}
 const remaining=await readRecord(id);
 const count=data?.length??0;
 if(!error&&count===0&&remaining&&!profile.is_commissioner){display('Survived (RLS denied DELETE)');note('PASS: participant DELETE affected 0 rows; QA comment still exists. Copy ID for commissioner follow-up.','pass');}
 else if(!error&&count===1&&!remaining&&profile.is_commissioner){record=null;display('Deleted');note('PASS: commissioner DELETE affected 1 row; QA comment no longer exists.','pass');}
 else {display(remaining?'Still exists':'Missing');note('REVIEW: DELETE result='+ (error?'error':count+' rows')+'; record '+(remaining?'exists':'missing')+'. Expected behavior not confirmed.','error');if(!remaining)record=null;}
}));
$('verify').addEventListener('click',()=>withBusy(async()=>{
 if(!record)return;const found=await readRecord(record.id);display(found?'Exists':'Not found');note(found?'Record #'+record.id+' still exists.':'Record no longer exists.',found?'':'warn');if(!found){record=null;display('Not found');}
}));
$('copy').addEventListener('click',async()=>{if(!record)return;try{await navigator.clipboard.writeText(String(record.id));note('Copied disposable record ID '+record.id+'.');}catch{note('Copy unavailable. Record ID is displayed above.','warn');}});
$('other-id').addEventListener('input',()=>{other=null;$('other-result').textContent='';buttons();});
$('inspect').addEventListener('click',()=>withBusy(async()=>{
 other=null;const raw=$('other-id').value.trim();if(!/^[1-9][0-9]*$/.test(raw)){note('Enter a valid positive numeric record ID.','error');return;}
 const found=await readRecord(raw);
 if(!found||found.season!==2026||found.week!==18||!found.body.startsWith(PREFIX)||found.author_id===me.id){note('No eligible participant-owned QA record found for that ID.','error');return;}
 const {data:owner,error}=await db.from('league_members').select('username,is_commissioner').eq('user_id',found.author_id).maybeSingle();
 if(error||!owner||owner.is_commissioner){note('Cannot verify a non-commissioner owner.','error');return;}
 other=found;$('other-result').textContent='Verified QA record #'+found.id+' owned by '+owner.username+'.';note('QA marker and participant ownership verified. Ready for explicit commissioner DELETE.');buttons();
}));
$('delete-other').addEventListener('click',()=>withBusy(async()=>{
 if(!other)return;const id=other.id;
 if(!confirm('Commissioner DELETE of verified participant QA comment #'+id+'?'))return;
 const check=await readRecord(id);
 if(!check||check.body!==other.body||check.author_id!==other.author_id||check.season!==2026||check.week!==18){other=null;throw new Error('QA record changed or vanished. Re-inspect before deleting.');}
 const {data,error}=await db.from('comments').delete().eq('id',id).select('id');
 if(error)throw error;
 const found=await readRecord(id);const count=data?.length??0;
 other=null;$('other-result').textContent='Record '+id+': '+(found?'still exists':'no longer exists')+'.';
 note(count===1&&!found?'PASS: commissioner deleted participant-owned QA record (1 row), verified absent.':'REVIEW: deleted '+count+' rows; record '+(found?'exists':'missing')+'.',count===1&&!found?'pass':'error');
}));
async function init(){
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user){note('Not signed in. Use username login pilot, then return here.','warn');return;}
 const {data:member,error:memberError}=await db.from('league_members').select('username,is_active,is_commissioner').eq('user_id',user.id).maybeSingle();
 if(memberError||!member?.is_active){note('Active membership required.','error');return;}
 me=user;profile=member;
 $('identity').textContent='Authenticated as '+member.username+' ('+(member.is_commissioner?'commissioner':'participant')+').';
 $('qa').classList.remove('hidden');note('Ready. Create a disposable QA comment.');buttons();
}
init().catch(e=>note('Session check failed: '+e.message,'error'));
