# B Secure — Privacy Policy

**Effective date:** November 13, 2026  
**Developer:** L.C.Manreal (BlazeDevStudio)  
**Contact:** manrealloumer@gmail.com

This policy describes how the **B Secure** Chrome extension (version 11.5.0) uses data to password-protect and restore browser sessions.

## Data processed

- **Authentication information:** When you set or enter a B Secure password, the extension processes it locally to create or verify a salted PBKDF2-SHA256 password hash. It stores the salt, hash and hashing parameters, **not your plaintext password**. The password is not sent to the developer.
- **Browser-tab URLs:** When B Secure locks tabs, it stores the URLs of tabs it parks so it can reopen those pages after a successful unlock. Saved URLs may contain personal information or sensitive query parameters. B Secure does not read the contents of visited pages or intentionally store a complete browsing history.
- **Security and session settings:** The extension stores your configured failed-attempt limit, lock cooldown, automatic relock settings, failed-attempt counts, and lock/session timestamps. It monitors normal browser window and tab events solely to apply these protections.

## Where data goes

The extension stores these records locally using Chrome extension storage (primarily `chrome.storage.local` and temporary `chrome.storage.session`). **B Secure does not send stored passwords, password hashes, saved URLs, settings, or usage data to the developer or to a remote analytics service.** It does not sell or share that data with advertisers. B Secure does not use tracking scripts or remote services for locking.

The settings page may display an optional **PayPal donation QR** stored as an image within the extension. Scanning it or visiting PayPal is your choice; PayPal handles any information you submit to PayPal under its own privacy terms. B Secure does not collect payment details.

## Retention and control

Password verification data and settings remain in the Chrome profile's extension storage until changed, reset, or removed. Parked-tab URL records are ordinarily deleted after successful restoration; orphaned records can remain for recovery and are eligible for cleanup after 30 days. Temporary session state is managed by Chrome. You can clear B Secure's extension storage or uninstall the extension to remove its local records, but doing so can erase recovery data for parked tabs.

If you forget your B Secure password, the developer cannot recover it. The extension is **not** an operating-system security boundary: anyone with sufficient control over Chrome or the device may be able to disable, remove, or bypass it.

## Changes and contact

This policy may be updated if the extension's data practices change. The current policy will remain accessible on this page.

Questions about privacy or the extension: **manrealloumer@gmail.com**.
