/* Validated settings, migration defaults, and restart policy. */
'use strict';
const POLICY_DEFAULT=Object.freeze({maxAttempts:5,closeOnLimit:true,cooldownMinutes:5,blockNewTabs:true,relockMode:'immediate',relockMinutes:5});
function policyValid(raw){
  return raw && Number.isInteger(raw.maxAttempts) && raw.maxAttempts>=3 && raw.maxAttempts<=20 &&
    typeof raw.closeOnLimit==='boolean' && typeof raw.blockNewTabs==='boolean' &&
    Number.isInteger(raw.cooldownMinutes) && raw.cooldownMinutes>=1 && raw.cooldownMinutes<=60 &&
    ['immediate','after','disabled'].includes(raw.relockMode) &&
    Number.isInteger(raw.relockMinutes) && raw.relockMinutes>=1 && raw.relockMinutes<=1440;
}
async function policy(){
  const {policy:stored}=await chrome.storage.local.get('policy');
  // Older B Secure policies omit the relock fields: migrate them to fail-closed defaults.
  const merged=stored&&typeof stored==='object'?{...POLICY_DEFAULT,...stored}:null;
  return policyValid(merged)?merged:{...POLICY_DEFAULT};
}
// chrome.storage.session survives MV3 worker suspension but NOT an actual browser restart.
// A local marker permits explicitly configured short reopening windows across restarts.
// This is convenience protection, not an OS/session-security boundary.
function mayResume(state,p,now){
  if(!state||state.unlocked!==true)return false;
  if(p.relockMode==='immediate')return false;
  if(p.relockMode==='disabled')return true;
  const closed=Number.isFinite(state.closedAt)?state.closedAt:state.lastSeenAt;
  if(!Number.isFinite(closed)||closed<=0||closed>now)return false;
  return now-closed<p.relockMinutes*60000;
}
