const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..');
function event(){const listeners=[];return {addListener(f){listeners.push(f)},fire(...args){return Promise.all(listeners.map(f=>f(...args)))}}}
function storage(){const data={};return {data,async get(keys){if(keys===null)return {...data};if(typeof keys==='string')return {[keys]:data[keys]};if(Array.isArray(keys))return Object.fromEntries(keys.map(k=>[k,data[k]]));return Object.fromEntries(Object.entries(keys).map(([k,d])=>[k,data[k]??d]));},async set(obj){Object.assign(data,obj);},async remove(keys){for(const key of Array.isArray(keys)?keys:[keys])delete data[key];}}}
function createEnvironment(n=2){
 const local=storage(),session=storage();
 let seq=20;const tabMap=new Map(); const removed=[];const updates=[];const windowsClosed=[];
 for(let i=0;i<n;i++)tabMap.set(++seq,{id:seq,url:'https://example.org/p/'+i,windowId:1,active:i===0});
 const c={runtime:{id:'unit-bsecure',getURL:(p)=>'chrome-extension://unit-bsecure/'+p,onMessage:event(),onInstalled:event(),onStartup:event()},
  storage:{local,session},
  tabs:{onCreated:event(),onUpdated:event(),onActivated:event(),async query(q={}){let t=[...tabMap.values()];if(q.windowId)t=t.filter(x=>x.windowId===q.windowId);if(q.active)t=t.filter(x=>x.active);return t.map(x=>({...x}));},async get(id){if(!tabMap.has(id))throw Error('Missing tab');return {...tabMap.get(id)};},async update(id,opts){if(!tabMap.has(id))throw Error('Missing tab');const t=tabMap.get(id);Object.assign(t,opts);updates.push({id,url:opts.url});return {...t};},async remove(id){if(!tabMap.has(id))throw Error('Missing tab');tabMap.delete(id);removed.push(id);},async create(opts){const t={id:++seq,windowId:opts.windowId||1,active:opts.active||false,url:opts.url};tabMap.set(t.id,t);return {...t};}},
  windows:{onCreated:event(),onRemoved:event(),async getAll(){return [...new Set([...tabMap.values()].map(x=>x.windowId))].map(id=>({id}))},async remove(id){windowsClosed.push(id);for(const [tid,t] of tabMap)if(t.windowId===id)tabMap.delete(tid)}},
  alarms:{onAlarm:event(),async create(){}},action:{setBadgeText:async()=>{}}};
 function spawn(){const context=vm.createContext({chrome:c,crypto:webcrypto,TextEncoder,btoa,atob,console,Date,Uint8Array,Number,Math,Promise,setTimeout,clearTimeout}); context.importScripts=(name)=>vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name}); vm.runInContext(fs.readFileSync(path.join(root,'bg.js'),'utf8'),context,{filename:'bg.js'});return context;}
 return {c,local,session,spawn,tabMap,removed,updates,windowsClosed,async call(ctx,action,fields={},from='unit-bsecure'){return ctx.handle({action,...fields},{id:from})}};
}
(async()=>{
 const e=createEnvironment(2),sw=e.spawn();
 let r=await e.call(sw,'STATUS');assert(!r.configured);
 r=await e.call(sw,'SAVE_PASSWORD',{password:'my-unique-long-password'});assert(r.ok);
 r=await e.call(sw,'STATUS');assert(!r.locked);assert.equal(e.local.data.key,undefined);assert.equal(e.local.data.auth.algo,'PBKDF2-SHA256');
 assert(!(await e.call(sw,'SAVE_POLICY',{policy:{maxAttempts:2,closeOnLimit:true,cooldownMinutes:5,blockNewTabs:true,relockMode:'immediate',relockMinutes:5},currentPassword:'my-unique-long-password'})).ok);
 r=await e.call(sw,'SAVE_POLICY',{policy:{maxAttempts:3,closeOnLimit:true,cooldownMinutes:5,blockNewTabs:true,relockMode:'immediate',relockMinutes:5},currentPassword:'my-unique-long-password'});assert(r.ok);
 assert(!(await e.call(sw,'SAVE_POLICY',{policy:{maxAttempts:10,closeOnLimit:false,cooldownMinutes:1,blockNewTabs:false,relockMode:'immediate',relockMinutes:5},currentPassword:'wrong'})).ok);
 assert.equal((await e.call(sw,'STATUS')).policy.maxAttempts,3);
 r=await e.call(sw,'LOCK');assert(r.ok);
 assert.equal([...e.tabMap.values()].filter(t=>t.url.startsWith('chrome-extension://unit-bsecure/lock.html')).length,2);
 // Repeated bad passwords arriving together cannot bypass serialized failure accounting.
 const results=await Promise.all(Array.from({length:9},()=>e.call(sw,'UNLOCK',{password:'wrong'})));
 assert(results.every(x=>!x.ok));
 assert.equal(e.local.data.attempts.failures,3);assert(e.local.data.attempts.until>Date.now());
 assert.deepEqual(e.windowsClosed,[1]);
 assert(!(await e.call(sw,'UNLOCK',{password:'my-unique-long-password'})).ok,'Cooldown must block even the correct password');
 e.local.data.attempts.until=Date.now()-1;
 r=await e.call(sw,'UNLOCK',{password:'my-unique-long-password'});assert(r.ok);
 assert.equal(e.local.data.attempts,undefined);
 // New window remains guarded by lock page while locked.
 const f=createEnvironment(1),fw=f.spawn();
 await f.call(fw,'SAVE_PASSWORD',{password:'abcdefghi'});await f.call(fw,'LOCK');
 const newTab={id:80,windowId:1,url:'chrome://newtab/',active:false};f.tabMap.set(80,newTab);
 await f.c.tabs.onCreated.fire({...newTab});await new Promise(ok=>setTimeout(ok,0));
 assert(f.removed.includes(80),'New tab must be dismissed while lock screen exists');
 const newWin={id:81,windowId:2,url:'chrome://newtab/',active:true};f.tabMap.set(81,newWin);
 await f.c.tabs.onCreated.fire({...newWin});await new Promise(ok=>setTimeout(ok,0));
 assert.equal(f.tabMap.get(81).url,'chrome-extension://unit-bsecure/lock.html');
 await assert.rejects(f.call(fw,'UNLOCK',{password:'abcdefghi'},'foreign-extension'),/Invalid extension request/);
 // Worker can restart without losing session/cooldown state.
 const fresh=f.spawn();assert((await f.call(fresh,'STATUS')).locked);
 r=await f.call(fresh,'UNLOCK',{password:'abcdefghi'});assert(r.ok);
 assert.equal((await f.call(fresh,'STATUS')).locked,false);
 // Changing password requires existing password; change then lock and validate new credential.
 assert(!(await f.call(fresh,'SAVE_PASSWORD',{password:'changed-secret',oldPassword:'incorrect'})).ok);
 assert((await f.call(fresh,'SAVE_PASSWORD',{password:'changed-secret',oldPassword:'abcdefghi'})).ok);
 await f.call(fresh,'LOCK');assert(!(await f.call(fresh,'UNLOCK',{password:'abcdefghi'})).ok);
 assert((await f.call(fresh,'UNLOCK',{password:'changed-secret'})).ok);
 // Immediate policy must relock on a genuine new browser session, not on service worker suspension.
 f.session.data.sessionReady=undefined;delete f.session.data.unlocked;
 const reboot=f.spawn();assert((await f.call(reboot,'STATUS')).locked);
 // Restart triggers locked startup and keeps URL recovery, even with 80 tabs.
 const busy=createEnvironment(80),busyWorker=busy.spawn();await busy.call(busyWorker,'SAVE_PASSWORD',{password:'testing-ram-passphrase'});
 busy.session.data.sessionReady=undefined;delete busy.session.data.unlocked;
 await busy.c.runtime.onStartup.fire();await new Promise(ok=>setTimeout(ok,5));
 assert.equal([...busy.tabMap.values()].filter(t=>t.url.startsWith('chrome-extension://unit-bsecure/lock.html')).length,80);
 assert.equal(Object.keys(busy.local.data).filter(k=>k.startsWith('restore:')).length,80);
 assert.equal(busy.updates.length,80);
 assert((await busy.call(busyWorker,'UNLOCK',{password:'testing-ram-passphrase'})).ok);
 assert.equal(busy.updates.length,81,'Unlock must restore exactly one tab, not all 80');
 // Legacy policies are migrated to immediate relock (safe default).
 const old=createEnvironment(1),ow=old.spawn();await old.call(ow,'SAVE_PASSWORD',{password:'legacy'});
 old.local.data.policy={maxAttempts:5,closeOnLimit:true,cooldownMinutes:5,blockNewTabs:true};
 assert.equal((await old.call(ow,'STATUS')).policy.relockMode,'immediate');
 // Timed relock should survive Chrome restarts with a fresh storage.session.
 const timed=createEnvironment(1),tw=timed.spawn();
 await timed.call(tw,'SAVE_PASSWORD',{password:'timerpass'});
 const timedPolicy={maxAttempts:5,closeOnLimit:true,cooldownMinutes:5,blockNewTabs:true,relockMode:'after',relockMinutes:10};
 assert((await timed.call(tw,'SAVE_POLICY',{policy:timedPolicy,currentPassword:'timerpass'})).ok);
 timed.local.data.resumeState={unlocked:true,lastSeenAt:Date.now()-5*60000,closedAt:Date.now()-5*60000};
 delete timed.session.data.sessionReady;delete timed.session.data.unlocked;
 const tw2=timed.spawn();assert.equal((await timed.call(tw2,'STATUS')).locked,false,'Recent Chrome close must resume');
 await timed.call(tw2,'LOCK');await timed.call(tw2,'UNLOCK',{password:'timerpass'});
 timed.local.data.resumeState={unlocked:true,lastSeenAt:Date.now()-11*60000,closedAt:Date.now()-11*60000};
 delete timed.session.data.sessionReady;delete timed.session.data.unlocked;
 const tw3=timed.spawn();assert.equal((await timed.call(tw3,'STATUS')).locked,true,'Expired close must relock');
 // Even if Chrome stays alive in background with storage.session, a new window must recheck duration.
 await timed.call(tw3,'UNLOCK',{password:'timerpass'});
 timed.local.data.resumeState.closedAt=Date.now()-11*60000;
 assert.equal((await timed.call(tw3,'STATUS')).locked,true);
 // Last-window event stores an exact time (and reopening within threshold clears it).
 await timed.call(tw3,'UNLOCK',{password:'timerpass'});
 timed.tabMap.clear();await timed.c.windows.onRemoved.fire(1);
 assert(timed.local.data.resumeState.closedAt>0);
 const reopenedTab={id:501,windowId:9,active:true,url:'https://example.org/new'};
 timed.tabMap.set(reopenedTab.id,reopenedTab);
 await timed.c.windows.onCreated.fire({id:9,type:'normal'});
 assert.equal(timed.local.data.resumeState.closedAt,null);
 assert.equal((await timed.call(tw3,'STATUS')).locked,false);
 // Disabled mode must preserve unlocked state through restart, but manual lock overrides it.
 const offPolicy={...timedPolicy,relockMode:'disabled'};
 assert((await timed.call(tw3,'SAVE_POLICY',{policy:offPolicy,currentPassword:'timerpass'})).ok);
 timed.local.data.resumeState={unlocked:true,lastSeenAt:Date.now()-86400000,closedAt:Date.now()-86400000};
 delete timed.session.data.sessionReady;delete timed.session.data.unlocked;
 const tw4=timed.spawn();assert.equal((await timed.call(tw4,'STATUS')).locked,false);
 assert((await timed.call(tw4,'LOCK')).ok);
 assert.equal((await timed.call(tw4,'STATUS')).locked,true);
 // Reject out-of-range timer values.
 assert(!(await timed.call(tw4,'SAVE_POLICY',{policy:{...offPolicy,relockMinutes:1441},currentPassword:'timerpass'})).ok);
 // Corrupt stored auth rejects credentials cleanly.
 const broken=createEnvironment(0),bc=broken.spawn();broken.local.data.auth={v:2,algo:'PBKDF2-SHA256',hash:'junk',salt:'junk',iterations:160000};
 assert(!(await broken.call(bc,'UNLOCK',{password:'anything'})).ok);
 console.log('PASS: security groups including restart timers — hash, policy validation, protected updates, lock, parallel brute-force, cooldown, window closure, blocked tab/new window, foreign sender, worker restart, change password, 80-tab lazy restoration and corrupt credential.');
})().catch(err=>{console.error(err);process.exitCode=1});
