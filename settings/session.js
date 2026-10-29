/* Session and recovery commands. */
'use strict';
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
