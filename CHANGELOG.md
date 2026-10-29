# Changelog

## 11.5.0 — settings refinement and source organization
- PayPal QR in the left settings margin on desktop, moved below forms on narrow screens.
- Password creation acknowledgement and clear password-recovery warning.
- Split styles, settings controllers, and worker policy into separate source modules; keep extension Z artwork and runtime security behavior.


## 11.4.0 — interface cleanup
- Separate padlock brand mark for in-page B Secure header (Z extension icon unchanged).
- Single-column settings layout and collapsed PayPal QR area.
- Remove promotional features, decorative headings and redundant wording.
- Flat blue/white/black palette with restrained red only for alerts/status.
- Simpler lock screen and popup; animations and settings IDs preserved.
- No change to authentication, relock settings, tab handling or security policies.

## 11.3.0 — browser-close timer
- Configurable immediate / delayed (1–1440 minutes) / disabled automatic relock in Settings.
- Last normal Chrome-window close timestamp, background-process window reopening check, once-a-minute fallback heartbeat.
- Keeps existing settings on upgrade; old configurations default to immediate relock.
- Adds simulated restart, timeout, window-close, disabled mode and old-policy regression cases.
- Preserves supplied exact Z icon, QR and previous features.

## 11.2.0 — October 30, 2026
- Replaced existing logo variant and all legacy extension icons with the exact uploaded Z artwork.
- Preserved the lock hero, responsive page layout, and existing low-memory/session protection logic.
- Added manifest action default icons and settings page favicon.
- Included supplied full-resolution artwork and regression tests for asset references.

## 11.1.0
- Lock-page and app-brand refinement. See earlier source archive for prior release details.
