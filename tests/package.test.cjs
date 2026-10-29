const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
assert.equal(m.manifest_version,3);assert.equal(m.name,'B Secure');assert.equal(m.version,'11.4.0');
assert.equal(m.author,'L.C.Manreal');assert(!m.permissions.includes('webRequest'));
for(const f of [m.background.service_worker,m.action.default_popup,m.options_ui.page,'lock.html','assets/paypal-donation-qr.png', ...Object.values(m.icons), ...Object.values(m.action.default_icon)])assert(fs.existsSync(path.join(root,f)),f);
assert(fs.readFileSync(path.join(root,'options.html'),'utf8').includes('manrealloumer@gmail.com'));
console.log('PASS: manifest and packaged asset references');

// Verify no original blacklock/bespoke Z substitutes remain as UI assets.
for(const view of ['lock.html','popup.html','options.html']) { const html=fs.readFileSync(path.join(root,view),'utf8'); assert(html.includes('assets/bsecure-lock-mark.svg'));assert(html.includes('assets/bsecure-z-48.png'));  assert(!html.includes('brand-z-64.png')); assert(!html.includes('blacklock48.png')); }
assert(fs.existsSync(path.join(root,'assets/bsecure-z-original.png')));

assert(m.permissions.includes('alarms'));

const opts=fs.readFileSync(path.join(root,'options.html'),'utf8');
const lock=fs.readFileSync(path.join(root,'lock.html'),'utf8');
assert(!opts.includes('Built lean. Built private.'));
assert(!opts.includes('Take control of your browsing session.'));
assert(!lock.includes('parked browsing tabs'));
assert(opts.includes('id="policy-form"') && opts.includes('id="relockMode"'));
assert(fs.existsSync(path.join(root,'assets/bsecure-lock-mark.svg')));
assert.equal(m.icons['48'],'assets/bsecure-z-48.png');
console.log('PASS: lean UI, separate header identity and unchanged extension icons');
