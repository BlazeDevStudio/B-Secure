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
  document.getElementById('password-ack-container').hidden=configured;
  document.getElementById('password-ack').required=!configured;
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
refresh();
