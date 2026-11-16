'use strict';
// All comments are fictional or session-only. No network calls or storage.
const sample={
  9:[{name:'Fourth Down Fred',text:'Another week, another masterpiece of questionable football.',time:'Mon • 9:14 PM'},{name:'Punt Collector',text:'Thanks to the opposing offense for its continued support.',time:'Mon • 9:27 PM'}],
  10:[{name:'Fumble King',text:'Is it too early to celebrate somebody else’s loss?',time:'Sun • 1:42 PM'},{name:'Fourth Down Fred',text:'The standings are looking like a crime scene. 😂',time:'Sun • 2:08 PM'},{name:'Punt Collector',text:'Losing takes dedication. Respect the process.',time:'Sun • 2:26 PM'}],
  11:[{name:'Fumble King',text:'New week. Fresh opportunities for disappointment.',time:'Sun • 10:01 AM'}]
};
const added=new Map();
const week=document.getElementById('week'),feed=document.getElementById('feed'),number=document.getElementById('week-number');
const form=document.getElementById('comment-form'),input=document.getElementById('comment'),remaining=document.getElementById('remaining');
for(let n=1;n<=18;n++){const option=document.createElement('option');option.value=n;option.textContent='Week '+n;week.append(option);}
week.value='10';
function render(){
 const n=Number(week.value);number.textContent=String(n);feed.replaceChildren();
 const entries=[...(sample[n]||[]),...(added.get(n)||[])];
 if(!entries.length){const p=document.createElement('p');p.className='empty';p.textContent='No comments yet. Start the conversation!';feed.append(p);return;}
 for(const entry of entries){
  const article=document.createElement('article');article.className='message';
  const meta=document.createElement('div');meta.className='meta';
  const who=document.createElement('div'),avatar=document.createElement('span'),author=document.createElement('span'),time=document.createElement('span'),body=document.createElement('p');
  avatar.className='avatar';avatar.textContent=entry.name.charAt(0).toUpperCase();
  author.className='author';author.textContent=entry.name;
  time.className='time';time.textContent=entry.time;
  body.textContent=entry.text;
  who.append(avatar,author);meta.append(who,time);article.append(meta,body);feed.append(article);
 }
}
week.addEventListener('change',render);
input.addEventListener('input',()=>remaining.textContent=(280-input.value.length)+' characters remaining');
form.addEventListener('submit',event=>{
 event.preventDefault();const name=document.getElementById('name').value.trim(),text=input.value.trim();if(!name||!text)return;
 const n=Number(week.value),entries=added.get(n)||[];entries.push({name:name.slice(0,30),text:text.slice(0,280),time:'Just now • demo'});added.set(n,entries);
 input.value='';remaining.textContent='280 characters remaining';render();
});
render();