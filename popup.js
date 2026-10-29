'use strict';wireVisibility();
async function refresh(){
  const r=await send('STATUS');if(!r.ok)return messageFor('message',r.error,'bad');
  const s=document.getElementById('state');s.textContent=!r.configured?'Setup':r.locked?'Locked':'Unlocked';s.className='pill '+(r.configured&&!r.locked?'ok':'warn');
  document.getElementById('sub').textContent=!r.configured?'Create a password to begin.':r.locked?'Enter password.':'Ready.';
  document.getElementById('setup').hidden=!!r.configured;
  document.getElementById('lock').hidden=!r.configured||r.locked;
  document.getElementById('unlock-form').hidden=!r.configured||!r.locked;
  if(r.wait)messageFor('message','Cooldown: '+seconds(r.wait)+' seconds.','bad');
}
document.getElementById('settings').addEventListener('click',()=>chrome.runtime.openOptionsPage());
document.getElementById('setup').addEventListener('click',()=>chrome.runtime.openOptionsPage());
document.getElementById('lock').addEventListener('click',async()=>{
  setBusy('lock',true,'','Locking…');
  try{const r=await send('LOCK');if(!r.ok)messageFor('message',r.error,'bad');else await refresh();}
  finally{setBusy('lock',false,'Lock now');}
});
document.getElementById('unlock-form').addEventListener('submit',async e=>{
  e.preventDefault();const value=document.getElementById('password').value;document.getElementById('password').value='';
  setBusy('unlock',true,'','Verifying…');
  try{const r=await send('UNLOCK',{password:value});if(!r.ok)messageFor('message',r.error+(r.wait?' Wait '+seconds(r.wait)+'s.':''),'bad');else{messageFor('message','Unlocked.','good');await refresh();}}
  finally{setBusy('unlock',false,'Unlock');}
});refresh();
