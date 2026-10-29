# B Secure 11.5.0 — settings and source organization

By **L.C.Manreal** — **manrealloumer@gmail.com**.

## What's changed
- Replaces all old extension, toolbar, tab favicon, lock-screen header, options, and popup brand icons with the **exact Z artwork supplied by the author on October 30, 2026** (original file included at `assets/bsecure-z-original.png`).
- Native 16/32/48/64/128/256px PNG resizes use only Pillow/Lanczos and preserve original geometry, colors, red dot and dark rounded background. No generated/reimagined logo is used.
- Version increment to 11.4.0; the lock/unlock CSS animations and lock motif from 11.1 are retained unchanged.
- No changes to password, attempt counters, tab locking or other security-critical runtime logic.

## Install
Extract the ZIP to a stable folder, visit `chrome://extensions`, enable Developer mode, select **Load unpacked** and choose that folder containing `manifest.json`. Install in a disposable Chrome profile and confirm settings, tab icon and toolbar icon before replacing the previous extension.

A separately packaged CRX3 may be installed only where Chrome policy allows CRX sideloading. Signatures use the existing owner-supplied B Secure signing key from the previous package; keep the private key offline and do not put it in source control. To avoid losing storage, back up any parked URLs before changing the extension ID, as Chrome considers differing IDs separate extensions.

Chrome extensions cannot replace Chrome's built-in back/forward/reload icons, cannot prevent all bypass paths, and cannot reliably terminate Chrome as a process. Window-close protection and new-tab guard operate within Chrome extension APIs only.

## Tests
Run `node --test tests/security.test.cjs` and `node tests/package.test.cjs` in the unpacked source directory. Tests are simulated, not a substitute for physical testing on 512 MB hardware or live Chrome UI testing.

The PayPal QR lives at `assets/paypal-donation-qr.png` and is bundled locally.

## Automatic relock on browser close (v11.3.0)
In Settings → Failed-attempt protection → Automatic relock, choose **Immediately** (default), **After N minutes** (1–1440), or **Disabled** (stays unlocked on reopening). Security settings changes require the current password. Manual Lock always locks.

Time measurement: The extension records when the **last normal Chrome window is closed**. Chrome may stay running in the background; new windows still check the elapsed time. If Chrome is forcibly terminated/crashes before the last-window event is saved, a once-per-minute heartbeat approximates the close time. This can relock **earlier than configured** in the worst case. This best-effort mechanism cannot protect another browser profile or a person who can disable extensions, edit the Chrome profile, or access Chrome internal pages.

No continuous background process or external network service is used. Startup state is persisted in chrome.storage.local; the service worker uses chrome.storage.session for its within-session state.

## Design revision (v11.4.0)
The **Z artwork remains unchanged** in the Chrome toolbar and extension icons. The in-page header uses a separate local SVG padlock mark (blue/white with a small red status dot). Settings are now single-column and task-based: password, security, session, an optional collapsed donation QR, and contact. Promotional feature cards, gradients, unnecessary lock-screen paragraphs, and repetitive footers have been removed. Reduced-motion behavior is supported. No external dependencies.

## 11.5.0 — Settings UI and source layout
- The donation QR is placed in a compact left rail on wide screens (moves below controls on narrower windows).
- Password creation requires acknowledgement that **B Secure has no password recovery**. A password cannot be recovered from its hash. Users can remove/reset the extension or create another profile; deleting the entire Chrome profile is **not a guaranteed requirement** and deleting profile data can cause needless data loss.
- Split CSS by view under `styles/`, settings controllers under `settings/`, and password policy under `core/`. MV3 worker behavior and previous security protections are preserved.
- No external assets, cloud services, trackers or frameworks.
