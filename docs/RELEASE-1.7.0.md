# KRAGE 1.7.0

## Lobby and interface
- Preserves map preview, live character, navigation and locker architecture. The Play card now contains callsign, Play Online, Practice and Lobby only.
- Practice stays in the Play card with compact mode, duration, opponent and skill steppers; the existing map selector remains available. It starts the same practice simulation; public matchmaking rules are unchanged.
- Graphite surfaces, off-white text, restrained crimson actions and gold currency/rewards. Shared selection, hover, focus, disabled, keyboard-hint and result-screen treatments. No decorative glow.
- Removed 875 conflicting legacy visual declarations for the redesigned controls. `app/v17.css` owns their visual theme; historical layout rules remain in the earlier stylesheets.
- Matching lobby, account, locker, challenge, chat, respawn, result and recovery surfaces. Optional lobby panels support Escape; account conflict decisions cannot be bypassed.
- Reserved space for chat at shorter laptop sizes; immediate weapon silhouette while the 3D locker view loads. Reduced-motion preference retained.

## Guest play and MICA
- If anonymous provider signup fails, guests can still create/join rooms and use quick play without logging in. Their fallback progress stays device-local. Signed-in identity/token failures never silently downgrade to guest access.
- Enable Supabase anonymous sign-in for server-backed guest rewards and subsequent verified-account transfer. Device-local KR is not imported into trusted account balances.
- Auth requests have bounded timeouts. Stale anonymous responses cannot replace a newer signed-in identity.
- MICA is positioned further from the first-person camera; its raised front sight now clears the receiver. Bead-to-center alignment and unobstructed rays beside/below the bead are covered across aspect ratios and finishes. World models and hit calculations are unchanged.

## Validation and deployment
- Simulation/presentation/server/account suite: 160 tests passed during this build; lint, TypeScript and production build checked again after the UI changes.
- Local browser verification covers guest custom-room creation and quick play, practice configuration, locker, challenges, settings and laptop layouts. These checks do not establish subjective design acceptance or certify every device.
- No new migration or room protocol change from 1.6. Deploy the new frontend; retain the 1.6 account migration and persistent reward volume requirements. Live provider credentials and cross-device authentication still need deployment checks.
- Eight moderate upstream dependency advisories remain from the 1.6 audit. No new dependencies were added.
- 1.8 sound work has not started.

Follow-up: Play uses a crosshair SVG; active navigation has a bottom crimson accent. New map-preview SVGs are explicitly reserved for the map overhaul. The follow-up passes 118 simulation/presentation tests (one additional sight-clearance regression), lint, types and production build.

Final visual check: removed the shoulder stock from MICA first-person geometry only; world/locker models retain it. Inline Practice and guest quick play passed browser checks with no runtime exceptions.
