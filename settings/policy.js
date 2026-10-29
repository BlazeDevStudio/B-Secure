/* Security configuration handlers. */
'use strict';
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
