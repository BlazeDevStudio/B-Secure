/* Password setup and replacement — isolated from other settings. */
'use strict';
document.getElementById('password-form').addEventListener('submit',async e=>{
  e.preventDefault();const password=document.getElementById('password').value;
  const confirm=document.getElementById('confirm').value;
  if(!password||password.length>128)return messageFor('message','Password cannot be empty and must be 128 characters or fewer.','bad');
  if(password!==confirm)return messageFor('message','Passwords do not match.','bad');
  if(!configured&&!document.getElementById('password-ack').checked)
    return messageFor('message','Confirm you understand there is no password recovery.','bad');
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
