'use strict';
wireVisibility();
let until=0,interval;
const pw=document.getElementById('password');
const panel=document.getElementById('lock-panel');
const hero=document.getElementById('hero-symbol');
function playState(state){
  panel.classList.remove('unlock-success','unlock-fail');
  hero.classList.remove('unlocking');
  void panel.offsetWidth;
  if(state==='success'){hero.classList.add('unlocking');panel.classList.add('unlock-success');}
  if(state==='fail'){panel.classList.add('unlock-fail');}
}
function showRemaining(r){
  const line=document.getElementById('attempts');
  if(r.remaining===undefined){line.hidden=true;return;}
  line.hidden=false;
  line.textContent=String(r.remaining)+' tries left.';
}
function cooldown(ms){
  until=Date.now()+ms;
  if(interval)clearInterval(interval);
  const update=()=>{
    const remain=Math.max(0,until-Date.now());
    document.getElementById('unlock').disabled=remain>0;
    if(remain)messageFor('message','Too many attempts. Try again in '+seconds(remain)+' seconds.','bad');
    else {clearInterval(interval);interval=null;messageFor('message','You may try again.','info');}
  };
  update();if(ms>0)interval=setInterval(update,1000);
}
async function start(){
  const r=await send('STATUS');
  if(!r.ok)return messageFor('message',r.error,'bad');
  showRemaining(r);
  if(!r.configured)return messageFor('message','Protection is not configured. Open B Secure settings.','info');
  if(!r.locked){messageFor('message','Already unlocked. Restoring this tab…','good');await send('RESTORE_CURRENT');return;}
  if(r.wait)cooldown(r.wait);
}
pw.addEventListener('keyup',e=>{document.getElementById('caps').hidden=!e.getModifierState('CapsLock');});
document.getElementById('unlock-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!pw.value||Date.now()<until)return;
  const value=pw.value;pw.value='';setBusy('unlock',true,'','Verifying…');
  try{
    const r=await send('UNLOCK',{password:value});
    if(!r.ok){playState('fail');showRemaining(r);if(r.wait)cooldown(r.wait);else messageFor('message',r.error,'bad');pw.focus();return;}
    playState('success');
    messageFor('message',r.restored?'Unlocked.':'Unlocked.','good');
  }finally{if(Date.now()>=until)setBusy('unlock',false,'Unlock');}
});
start();
