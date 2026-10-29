const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
assert.equal(m.manifest_version,3);assert.equal(m.name,'B Secure');assert.equal(m.version,'11.3.0');
assert.equal(m.author,'L.C.Manreal');assert(!m.permissions.includes('webRequest'));
for(const f of [m.background.service_worker,m.action.default_popup,m.options_ui.page,'lock.html','assets/paypal-donation-qr.png', ...Object.values(m.icons), ...Object.values(m.action.default_icon)])assert(fs.existsSync(path.join(root,f)),f);
assert(fs.readFileSync(path.join(root,'options.html'),'utf8').includes('manrealloumer@gmail.com'));
console.log('PASS: manifest and packaged asset references');

// Verify no original blacklock/bespoke Z substitutes remain as UI assets.
for(const view of ['lock.html','popup.html','options.html']) { const html=fs.readFileSync(path.join(root,view),'utf8'); assert(html.includes('assets/bsecure-z-64.png')); assert(!html.includes('brand-z-64.png')); assert(!html.includes('blacklock48.png')); }
assert(fs.existsSync(path.join(root,'assets/bsecure-z-original.png')));

assert(m.permissions.includes('alarms'));
