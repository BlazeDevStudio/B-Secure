'use strict';
let configured=false;
wireVisibility();
const relockMode=document.getElementById('relockMode');
function refreshRelockFields(){
  document.getElementById('relock-delay').hidden=relockMode.value!=='after';
  document.getElementById('relock-warning').hidden=relockMode.value!=='disabled';
}
relockMode.addEventListener('change',refreshRelockFields);
async function refresh(){
  const r=await send('STATUS');
  if(!r.ok){messageFor('message',r.error,'bad');return;}
  configured=!!r.configured;
  document.getElementById('current-container').hidden=!configured;
  document.getElementById('current').required=configured;
  document.getElementById('policy-password-field').hidden=!configured;
  document.getElementById('policyPassword').required=configured;
  document.getElementById('actions-card').hidden=!configured;
  const state=document.getElementById('state');
  state.textContent=!configured?'Setup needed':r.locked?'Locked':'Protected';
  state.className='pill '+(configured&&!r.locked?'ok':'warn');
  document.getElementById('save').textContent=configured?'Change password':'Create password';
  document.getElementById('settings-sub').textContent=configured?'Current password required to change.':'Create a password to begin.';
  const p=r.policy||{maxAttempts:5,cooldownMinutes:5,closeOnLimit:true,blockNewTabs:true,relockMode:'immediate',relockMinutes:5};
  document.getElementById('maxAttempts').value=String(p.maxAttempts);
  document.getElementById('cooldownMinutes').value=String(p.cooldownMinutes);
  document.getElementById('closeOnLimit').checked=p.closeOnLimit;
  document.getElementById('blockNewTabs').checked=p.blockNewTabs;
  relockMode.value=p.relockMode;
  document.getElementById('relockMinutes').value=String(p.relockMinutes);
  refreshRelockFields();
}
document.getElementById('password-form').addEventListener('submit',async e=>{
  e.preventDefault();const password=document.getElementById('password').value;
  const confirm=document.getElementById('confirm').value;
  if(!password||password.length>128)return messageFor('message','Password cannot be empty and must be 128 characters or fewer.','bad');
  if(password!==confirm)return messageFor('message','Passwords do not match.','bad');
  const wasConfigured=configured;
  setBusy('save',true,'','Saving…');
  try{
    const r=await send('SAVE_PASSWORD',{password,oldPassword:document.getElementById('current').value});
    if(!r.ok){messageFor('message',r.error+(r.wait?' Cooldown '+seconds(r.wait)+'s.':''),'bad');return;}
    document.getElementById('password-form').reset();
    messageFor('message',wasConfigured?'Password updated.':'Password created. Lock from the toolbar or restart Chrome.','good');
    await refresh();
  }finally{setBusy('save',false,configured?'Change password':'Create password');}
});
document.getElementById('policy-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const p={maxAttempts:Number(document.getElementById('maxAttempts').value),cooldownMinutes:Number(document.getElementById('cooldownMinutes').value),closeOnLimit:document.getElementById('closeOnLimit').checked,blockNewTabs:document.getElementById('blockNewTabs').checked,relockMode:relockMode.value,relockMinutes:Number(document.getElementById('relockMinutes').value)};
  setBusy('save-policy',true,'','Saving…');
  try{
    const r=await send('SAVE_POLICY',{policy:p,currentPassword:document.getElementById('policyPassword').value});
    document.getElementById('policyPassword').value='';
    messageFor('policy-message',r.ok?'Security settings saved.':r.error,r.ok?'good':'bad');
  }finally{setBusy('save-policy',false,'Save security settings');}
});
document.getElementById('lock').addEventListener('click',async()=>{
  setBusy('lock',true,'','Locking…');
  try{const r=await send('LOCK');messageFor('action-message',r.ok?'Locked.':r.error,r.ok?'good':'bad');await refresh();}
  finally{setBusy('lock',false,'Lock now');}
});
document.getElementById('export').addEventListener('click',async()=>{
  const r=await send('EXPORT_RECOVERY');if(!r.ok)return messageFor('action-message',r.error,'bad');
  const blob=new Blob(['# B Secure recovery URLs — keep this file private\n'+r.urls.join('\n')+'\n'],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='b-secure-recovery.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  messageFor('action-message','Exported '+r.urls.length+' URL(s).','good');
});
document.getElementById('restore').addEventListener('click',async()=>{
  if(!confirm('Restore all parked tabs? This may consume too much RAM on 512 MB devices.'))return;
  setBusy('restore',true,'','Restoring…');
  try{const r=await send('RESTORE_ALL');messageFor('action-message',r.ok?'Restored '+r.count+' tab(s).':r.error,r.ok?'good':'bad');}
  finally{setBusy('restore',false,'Restore all');}
});
refresh();
