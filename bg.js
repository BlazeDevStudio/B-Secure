/* B Secure 11.3.0 — privacy-oriented best-effort tab gate.
   Chrome extensions are not an OS or browser management security boundary. */
'use strict';
importScripts('crypto.js');
const LOCK_URL=chrome.runtime.getURL('lock.html');
const OPTIONS_URL=chrome.runtime.getURL('options.html');
const RECORD_PREFIX='restore:';
const POLICY_DEFAULT=Object.freeze({maxAttempts:5,closeOnLimit:true,cooldownMinutes:5,blockNewTabs:true,relockMode:'immediate',relockMinutes:5});
const HEARTBEAT='bsecure-active-windows';
const parking=new Set();
let initialization;
let authLane=Promise.resolve();
let gateLane=Promise.resolve();
let lifecycleLane=Promise.resolve();
let bootPromise;

function sequential(lane, fn){const next=lane.then(fn,fn);return [next,next.catch(()=>{})];}
function authSerial(fn){const [next,lane]=sequential(authLane,fn);authLane=lane;return next;}
function gateSerial(fn){const [next,lane]=sequential(gateLane,fn);gateLane=lane;return next;}
function lifecycleSerial(fn){const [next,lane]=sequential(lifecycleLane,fn);lifecycleLane=lane;return next;}

async function credential(){
  if(!initialization) initialization=(async()=>{
    const {auth,key}=await chrome.storage.local.get(['auth','key']);
    if(auth){if(key!==undefined) await chrome.storage.local.remove('key');return auth;}
    if(typeof key==='string' && key.length){
      const upgraded=await LockCrypto.create(key);
      await chrome.storage.local.set({auth:upgraded});
      await chrome.storage.local.remove('key');
      return upgraded;
    }
    if(key!==undefined) await chrome.storage.local.remove('key');
    return null;
  })().catch(error=>{initialization=undefined;throw error;});
  return initialization;
}
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
async function ensureSession(){
  if(!bootPromise)bootPromise=(async()=>{
    const session=await chrome.storage.session.get(['sessionReady','unlocked']);
    if(session.sessionReady===true)return;
    const [auth,p,{resumeState}]=await Promise.all([credential(),policy(),chrome.storage.local.get('resumeState')]);
    const allowed=!!auth&&mayResume(resumeState,p,Date.now());
    await chrome.storage.session.set({sessionReady:true,unlocked:allowed});
    if(!allowed&&resumeState?.unlocked)await chrome.storage.local.set({resumeState:{unlocked:false,lastSeenAt:Date.now(),closedAt:null}});
  })().catch(err=>{bootPromise=undefined;throw err;});
  return bootPromise;
}
async function setUnlocked(value){
  const now=Date.now();
  await chrome.storage.local.set({resumeState:{unlocked:!!value,lastSeenAt:now,closedAt:null}});
  await chrome.storage.session.set({sessionReady:true,unlocked:!!value});
}
async function isLocked(){
  if(!await credential())return false;
  await ensureSession();
  if((await chrome.storage.session.get('unlocked')).unlocked!==true)return true;
  const [{resumeState},p]=await Promise.all([chrome.storage.local.get('resumeState'),policy()]);
  if(resumeState?.closedAt!=null){
    // Chrome can keep background tasks alive after the last window closes.
    // Re-evaluate elapsed time even when storage.session never reset.
    if(p.relockMode==='immediate'||!mayResume(resumeState,p,Date.now())){
      await setUnlocked(false);return true;
    }
  }
  return false;
}
async function markLastWindowClosed(){
  const windows=await chrome.windows.getAll({windowTypes:['normal']});
  if(windows.length||await isLocked())return;
  const p=await policy();
  if(p.relockMode==='immediate'){await setUnlocked(false);return;}
  const {resumeState}=await chrome.storage.local.get('resumeState');
  if(resumeState?.unlocked){
    const now=Date.now();
    await chrome.storage.local.set({resumeState:{unlocked:true,lastSeenAt:now,closedAt:now}});
  }
}
async function handleWindowOpened(){
  if(await isLocked()){await gateSerial(guardTabs);return;}
  const {resumeState}=await chrome.storage.local.get('resumeState');
  if(resumeState?.unlocked&&resumeState.closedAt!=null){
    await chrome.storage.local.set({resumeState:{unlocked:true,lastSeenAt:Date.now(),closedAt:null}});
  }
}
async function refreshHeartbeat(){
  const windows=await chrome.windows.getAll({windowTypes:['normal']});
  if(!windows.length||await isLocked())return;
  const {resumeState}=await chrome.storage.local.get('resumeState');
  if(resumeState?.unlocked&&resumeState.closedAt==null)
    await chrome.storage.local.set({resumeState:{...resumeState,lastSeenAt:Date.now()}});
}
async function registerHeartbeat(){
  // One low-frequency alarm, rather than a persistent background page or polling loop.
  await chrome.alarms.create(HEARTBEAT,{periodInMinutes:1});
}
function lockUrl(url){return typeof url==='string'&&(url===LOCK_URL||url.startsWith(LOCK_URL+'#'));}
function tokenFrom(url){if(!lockUrl(url))return null;const token=url.slice(LOCK_URL.length+1);return /^[0-9a-f-]{36}$/i.test(token)?token:null;}
function restorable(url){return typeof url==='string'&&( /^(https?:|file:)/i.test(url) || url==='about:blank' || /^chrome:\/\/newtab\/?/i.test(url) || /^chrome-search:\/\/local-ntp\//i.test(url) || /^edge:\/\/newtab\/?/i.test(url));}
function localURL(url){return typeof url==='string'&&url.startsWith('chrome-extension://'+chrome.runtime.id+'/');}
function activeTab(){return chrome.tabs.query({active:true,currentWindow:true}).then(tabs=>tabs[0]||null);}

async function parkTab(tab){
  if(!tab||!Number.isInteger(tab.id)||parking.has(tab.id))return false;
  const url=tab.pendingUrl||tab.url;
  if(!restorable(url)||!await isLocked())return false;
  parking.add(tab.id);
  const key=RECORD_PREFIX+crypto.randomUUID();
  try{
    await chrome.storage.local.set({[key]:{url,created:Date.now()}});
    if(!await isLocked()){await chrome.storage.local.remove(key);return false;}
    await chrome.tabs.update(tab.id,{url:LOCK_URL+'#'+key.slice(RECORD_PREFIX.length)});
    return true;
  }catch(error){console.warn('B Secure parking error',String(error));return false;}
  finally{parking.delete(tab.id);}
}
async function restoreTab(tab){
  if(!tab||!Number.isInteger(tab.id))return false;
  const url=tab.pendingUrl||tab.url;
  const token=tokenFrom(url);
  if(!token){
    if(lockUrl(url)){
      try{await chrome.tabs.update(tab.id,{url:'chrome://newtab/'});return true;}catch(_){return false;}
    }
    return false;
  }
  const key=RECORD_PREFIX+token;
  const data=(await chrome.storage.local.get(key))[key];
  if(!data||!restorable(data.url))return false;
  try{
    await chrome.tabs.update(tab.id,{url:data.url});
    await chrome.storage.local.remove(key);
    return true;
  }catch(error){console.warn('B Secure restore error',String(error));return false;}
}
async function guardTabs(){
  if(!await isLocked())return;
  const tabs=await chrome.tabs.query({});
  let guarded=false,hasGate=false;
  for(const tab of tabs){
    if(lockUrl(tab.pendingUrl||tab.url)){hasGate=true;continue;}
    if(await parkTab(tab))guarded=true;
  }
  if(!guarded&&!hasGate){
    try{await chrome.tabs.create({url:LOCK_URL,active:true});}catch(_){}
  }
}
async function listSaved(){
  const obj=await chrome.storage.local.get(null);
  return Object.entries(obj).filter(([k,v])=>k.startsWith(RECORD_PREFIX)&&v&&restorable(v.url));
}
async function pruneSaved(){
  const entries=await listSaved();if(!entries.length)return;
  const tabs=await chrome.tabs.query({});
  const live=new Set(tabs.map(t=>tokenFrom(t.pendingUrl||t.url)).filter(Boolean));
  // Keep older orphaned records for recovery, but limit unbounded growth.
  const stale=entries.filter(([k,v])=>!live.has(k.slice(RECORD_PREFIX.length))&&Date.now()-(v.created||0)>30*86400000)
    .map(([key])=>key);
  if(stale.length)await chrome.storage.local.remove(stale);
}
async function verifyPassword(password,closeAtLimit){
  const now=Date.now();
  const {attempts:stored}=await chrome.storage.local.get('attempts');
  const until=Number(stored?.until)||0;
  if(until>now)return {ok:false,error:'Too many attempts. Try again after the cooldown.',wait:until-now,failures:stored.failures||0};
  const auth=await credential();
  if(!auth)return {ok:false,error:'Set up your password first.'};
  const correct=typeof password==='string'&&await LockCrypto.verify(password,auth);
  if(correct){await chrome.storage.local.remove('attempts');return {ok:true,failures:0};}
  const p=await policy();
  const failures=(until?0:Math.max(0,Math.min(20,stored?.failures|0)))+1;
  const atLimit=failures>=p.maxAttempts;
  const wait=atLimit?p.cooldownMinutes*60000:0;
  await chrome.storage.local.set({attempts:{failures,until:atLimit?Date.now()+wait:0}});
  return {ok:false,error:atLimit?'Attempt limit reached.':'Incorrect password.',
    failures,remaining:Math.max(0,p.maxAttempts-failures),wait,close:atLimit&&closeAtLimit&&p.closeOnLimit};
}
async function closeNormalWindows(){
  // Chrome has no extension API that guarantees termination of its entire process.
  const windows=await chrome.windows.getAll({windowTypes:['normal']});
  const results=await Promise.allSettled(windows.filter(w=>Number.isInteger(w.id)).map(w=>chrome.windows.remove(w.id)));
  return results.filter(r=>r.status==='fulfilled').length;
}
async function handle(message,sender){
  if(!message||typeof message.action!=='string'||!sender||sender.id!==chrome.runtime.id)
    throw Error('Invalid extension request.');
  const record=await credential();
  if(message.action==='STATUS'){
    const [{attempts},p]=await Promise.all([chrome.storage.local.get('attempts'),policy()]);
    return {ok:true,configured:!!record,locked:await isLocked(),
      wait:Math.max(0,(attempts?.until||0)-Date.now()),
      failures:Math.max(0,attempts?.failures||0),remaining:Math.max(0,p.maxAttempts-(attempts?.failures||0)),policy:p};
  }
  if(message.action==='UNLOCK')return authSerial(async()=>{
    const check=await verifyPassword(message.password,true);
    if(!check.ok){
      if(check.close){
        // Persist the failure/cooldown before closing windows; no timeout dependency.
        await closeNormalWindows().catch(error=>console.warn('B Secure close windows failed',String(error)));
      }
      return check;
    }
    await setUnlocked(true);
    const tab=sender.tab||await activeTab();
    return {ok:true,restored:await restoreTab(tab)};
  });
  if(message.action==='SAVE_PASSWORD')return authSerial(async()=>{
    if(typeof message.password!=='string'||!message.password||message.password.length>128)
      return {ok:false,error:'Use any non-empty password up to 128 characters.'};
    const wasConfigured=!!await credential();
    if(wasConfigured){
      const check=await verifyPassword(message.oldPassword,false);
      if(!check.ok)return check;
    }
    const auth=await LockCrypto.create(message.password);
    await chrome.storage.local.set({auth});
    initialization=Promise.resolve(auth);
    if(!wasConfigured)await setUnlocked(true);
    return {ok:true};
  });
  if(message.action==='SAVE_POLICY')return authSerial(async()=>{
    if(!policyValid(message.policy))return {ok:false,error:'Invalid security configuration.'};
    if(record){
      const check=await verifyPassword(message.currentPassword,false);
      if(!check.ok)return check;
    }
    await chrome.storage.local.set({policy:message.policy});
    return {ok:true,policy:message.policy};
  });
  if(message.action==='LOCK')return authSerial(async()=>{
    if(!record)return {ok:false,error:'Set a password first.'};
    await setUnlocked(false);
    await gateSerial(guardTabs);
    return {ok:true};
  });
  if(message.action==='RESTORE_CURRENT'){
    if(await isLocked())return {ok:false,error:'Unlock first.'};
    return {ok:true,restored:await restoreTab(sender.tab||await activeTab())};
  }
  if(message.action==='RESTORE_ALL'){
    if(await isLocked())return {ok:false,error:'Unlock first.'};
    const tabs=await chrome.tabs.query({});let count=0;
    for(const tab of tabs)if(await restoreTab(tab))count++;
    return {ok:true,count};
  }
  if(message.action==='EXPORT_RECOVERY'){
    if(await isLocked())return {ok:false,error:'Unlock first.'};
    const entries=await listSaved();return {ok:true,urls:entries.map(([,item])=>item.url)};
  }
  throw Error('Unknown action.');
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id)return false;
  handle(message,sender).then(respond).catch(e=>respond({ok:false,error:String(e?.message||'Unexpected error.')}));
  return true;
});
chrome.runtime.onInstalled.addListener(({reason})=>{
  if(reason==='install')chrome.tabs.create({url:OPTIONS_URL}).catch(()=>{});
  chrome.storage.local.setAccessLevel?.({accessLevel:'TRUSTED_CONTEXTS'}).catch?.(()=>{});
  registerHeartbeat().catch(console.warn);
  credential().catch(console.warn);
});
chrome.runtime.onStartup.addListener(()=>{
  (async()=>{
    await chrome.storage.local.setAccessLevel?.({accessLevel:'TRUSTED_CONTEXTS'});
    await credential();
    await ensureSession();
    await registerHeartbeat();
    if(await isLocked())await gateSerial(guardTabs);
    await pruneSaved();
  })().catch(console.warn);
});
chrome.alarms.onAlarm.addListener(alarm=>{
  if(alarm.name===HEARTBEAT)lifecycleSerial(refreshHeartbeat).catch(console.warn);
});
chrome.windows.onRemoved.addListener(()=>lifecycleSerial(markLastWindowClosed).catch(console.warn));
chrome.windows.onCreated.addListener(win=>win.type==='normal'?lifecycleSerial(handleWindowOpened).catch(console.warn):undefined);
chrome.tabs.onCreated.addListener(tab=>{
  (async()=>{
    if(!await isLocked())return;
    const p=await policy();
    if(!p.blockNewTabs){await gateSerial(()=>parkTab(tab));return;}
    // A new tab may briefly appear: the API notifies after creation, not before.
    const nearby=await chrome.tabs.query({windowId:tab.windowId});
    const gateExists=nearby.some(t=>t.id!==tab.id&&lockUrl(t.pendingUrl||t.url));
    if(gateExists){
      try{await chrome.tabs.remove(tab.id);}catch(_){}
    }else{
      try{await chrome.tabs.update(tab.id,{url:LOCK_URL});}catch(_){}
    }
  })().catch(console.warn);
});
chrome.tabs.onUpdated.addListener((id,change,tab)=>{
  if(!change.url||lockUrl(change.url)||localURL(change.url))return;
  gateSerial(()=>parkTab(tab)).catch(()=>{});
});
chrome.tabs.onActivated.addListener(({tabId})=>{
  (async()=>{
    const tab=await chrome.tabs.get(tabId);
    if(await isLocked())await gateSerial(()=>parkTab(tab));
    else await restoreTab(tab);
  })().catch(()=>{});
});
