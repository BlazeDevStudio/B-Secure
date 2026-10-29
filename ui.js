'use strict';
function send(action, fields = {}) {
  return chrome.runtime.sendMessage({action, ...fields}).catch(() => ({ok:false,error:'Extension connection unavailable. Try reloading this page.'}));
}
function messageFor(id, text, kind = 'info') {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'alert ' + kind;
  el.hidden = !text;
}
function setBusy(id, busy, label, busyLabel='Working…') {
  const el = document.getElementById(id);
  el.disabled = !!busy;
  el.textContent = busy ? busyLabel : label;
}
function wireVisibility() {
  document.querySelectorAll('button.peek').forEach(button => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.for);
    const showing = input.type === 'password';
    input.type = showing ? 'text' : 'password';
    button.textContent = showing ? 'Hide' : 'Show';
    button.setAttribute('aria-label', (showing ? 'Hide ' : 'Show ') + 'password');
    input.focus();
  }));
}
function seconds(ms) { return Math.max(1,Math.ceil(ms/1000)); }
