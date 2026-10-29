'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const fields=new Map();
function field(id){if(!fields.has(id))fields.set(id,{id,value:'',hidden:false,required:false,checked:false,listeners:{},addEventListener(type,cb){this.listeners[type]=cb;},reset(){}});return fields.get(id);}
let configured=false,saved=0;
const ui={
  document:{getElementById:field},console,
  wireVisibility(){},setBusy(){},seconds(n){return String(n)},
  messageFor(id,message,type){field(id).textContent=message;field(id).className=type;},
  async send(action,payload){
    if(action==='STATUS')return {ok:true,configured,locked:false,policy:{maxAttempts:5,cooldownMinutes:5,closeOnLimit:true,blockNewTabs:true,relockMode:'immediate',relockMinutes:5}};
    if(action==='SAVE_PASSWORD'){saved++; configured=true;return {ok:true};}
    return {ok:true};
  }
};
const ctx=vm.createContext(ui);
for(const file of ['options.js','settings/password.js','settings/policy.js','settings/session.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  await tick();
  assert.equal(field('password-ack-container').hidden,false,'Unconfigured warning visible');
  assert.equal(field('password-ack').required,true,'Initial setup acknowledgment required');
  field('password').value='not-a-recoverable-password';
  field('confirm').value=field('password').value;
  const submit=field('password-form').listeners.submit;
  await submit({preventDefault(){}});
  assert.equal(saved,0,'Must not save without acknowledgement');
  assert.match(field('message').textContent,/no password recovery/i);
  field('password-ack').checked=true;
  await submit({preventDefault(){}});
  await tick();
  assert.equal(saved,1,'Acknowledged password saved');
  assert.equal(field('password-ack-container').hidden,true,'Warning checkbox not required on change');
  assert.equal(field('password-ack').required,false);
  field('password').value='new-password';field('confirm').value='new-password';field('current').value='old-password';
  field('password-ack').checked=false;
  await submit({preventDefault(){}});
  assert.equal(saved,2,'Password update should not require repeat acknowledgement');
  console.log('PASS: first-time password warning and acknowledgement; existing-password update compatibility');
})().catch(e=>{console.error(e);process.exitCode=1});
