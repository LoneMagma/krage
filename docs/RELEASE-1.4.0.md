# KRAGE 1.4.0

## Maps and presentation
- Dune: remove five redundant blockers (terrace wall, two low stones, two flat-yard retaining edges). Keep the central divider, meaningful cover and main routes.
- Snow warehouse: concrete slab with subtle joints, painted inner walls, base trim and identification stripe, doorway mats/markings, two collidable corner crates and high ceiling beams. Doorways, stairs and navigation routes stay open.
- Backgrounds: distant scenery moved farther from arenas and softened with atmospheric color. Snow aurora now uses periodic curves without a longitude seam, connected ribbons and restrained drift.
- Hit confirmation: four outlined corner ticks leave the aiming center clear. Body hits are white; headshots amber. Short contracting pulse fades in 160/220 ms. Confirmed damage only; mixed shotgun pellet batches preserve headshot priority. Reduced-motion preference removes the scale pulse.
- Kill confirmation: original quiet 190 ms mono low-register cue, shared across weapons. Kill text/points use tighter type and spacing above the weapon. DOUBLE KILL, TRIPLE KILL, multikills and longer-streak labels distinguish achievements without extra screen flashes.
- Larger kill-feed entries; clearer health track/critical color, score/time strip and victory/defeat colors. Chat notices sit above health; names use simple text. Play card and map/character arrows have stronger color and focus. Shared weapon SVGs use cleaner, recognizable silhouettes across menus, slots and kill feed.

## Combat (shared by practice, room server and prediction)
- ECHO: 20 damage, 1.85× headshots, 84 ms interval, 35 rounds; recoil reduced to .011 with less climb.
- KILO: 32 damage, 2.1× headshots, 120 ms interval, 25 rounds. Predictable 25-shot climb-then-horizontal-sweep recoil inspired by a 7 shape; stance/ADS modifiers and bounded recovery remain.
- MICA: 12 pellets at 17 damage, 1.4× headshots, 310 ms interval. Centered close shots can kill at full health. One small horizontal shove per target inside 10 m; excludes teammates and shields. Lower recoil (.048), recovery starts after the shot animation while cooldown continues.
- Reload durations are 20% shorter than the pre-update build: ECHO 1.20 s, KILO 1.52 s, MICA 1.64 s. Existing reload poses follow these timers.
- EDGE: .42 s alternating diagonal slash, contact .16 s; .84 s stab, contact .22 s. Shared first/third-person pose, no slash thrust, short stab recovery pause. Combat range unchanged.

## KR and locker
- Standard firearm finishes: 500/650/700 KR. Special: 850/1000/1100. Prestige: 1800/2100/2400. Talon: 2000.
- New EDGE Slate: 600 KR, steel blade, pale edge/fuller's line, graphite/teal wrapped grip. Uses the normal blade and its normal combat stats; Talon remains the premium alternative.
- Existing recorded purchases receive the positive price difference once. A persistent migration marker prevents repeats after ledger pruning. Unrecorded purchases receive no invented refund. Earnings and daily/weekly rotation are unchanged; challenges remain the main source.
- Local practice profile remains local storage. The server economy adapter is groundwork, not public authenticated account storage or paid currency.

## Online and deployment
- Room browser lists only actual rooms with connected humans, including public matches. No default placeholder row. FIND MATCH creates/joins the public queue. Empty slots before room creation offer CREATE & INVITE; afterward they copy the real invite link.
- HUD frag target follows the selected room limit rather than a fixed 20.
- Deploy frontend and room service together: protocol 21. See DEPLOY.md. Existing room-process restarts end in-memory matches. No remote deployment is included.

## Verification
- 152 automated tests: 67 simulation, 48 presentation, 37 server. Includes close MICA lethality, shield-safe shove, Snow door navigation, recoil recovery/prediction, headshot-marker priority, price protection and Slate persistence.
- Lint, TypeScript and Render production build pass.
- Browser checks cover local quick play, Slate purchase/equip, HUD and Snow warehouse rendering. Follow-up checks verified bundled font loading, no page scroll at 1366×768, compact settings, empty-slot room creation, real invite links and a second browser joining the room. Screenshots are visual checks, not hardware-FPS or deployed-latency benchmarks.

## Next release gates
1. Friends test on the deployed build: 30-minute sessions, weak PCs, repeated rematches, tab switches and reconnects. Record RTT/jitter, server tick time and frame p95; check region before blaming rendering for ping.
2. Account foundation: guest-first identity, optional Google/email upgrade, stable player ID verified by room server, server-owned inventory/KR/challenge claims and atomic purchase ledger. Never trust an uploaded local balance or claimed match receipt. Use a controlled migration policy for old cosmetics.
3. Backups/restore, error monitoring, rate limits and staged frontend/rooms rollout with rollback. Confirm distribution rights for supplied sound assets.
4. Capture the Flag is the proposed objective mode, first as a 3v3 Snow custom-room prototype. Gun Game is not planned. See AUTH-AND-MODES.md.

## Follow-up polish
- Bundled Orbitron Black title font (SIL OFL included), warm amber lobby controls and explicit PLAY return buttons. Simpler crosshair/quality icons; camera motion lives in Movement. Removed redundant HUD/menu copy and enlarged weapon slots.
- Snow uses painted cladding, quieter concrete boundaries, flowing frost/ice texture instead of square ice tiles, and two distant station huts. All scenery remains outside collision/navigation space.
- Moving scales every firearm spread continuously up to 2.35× at running speed, including ADS. Sliding multiplies this further; crouch still improves accuracy. Shared simulation/prediction and crosshair use the same formula.
- Initial and subsequent spawns prefer unoccupied points, penalize close enemies and enemy sightlines more strongly (especially when already facing the spawn), and retain recent-death/spawn penalties and protection.
- Protocol 21 is required on frontend and room server after the shared spawn/spread changes.

## Final entry polish
Muted stone/taupe button accents replace bright amber. Lobby glow/shadows removed; visible keyboard outlines retained. Match intro is a larger restrained banner with room, map, mode, frag target, time and online count; MATCH START appears for its first second. Custom lobbies publish a shared three-second countdown before simulation begins. Inputs and match time remain frozen; a disconnect cancels it and clears readiness. Frontend and rooms require protocol 21.

Final browser smoke: host creates a room, readies up, starts the shared countdown, enters gameplay, receives the detailed intro and sees it clear automatically. No browser exceptions.

## Accuracy and readability correction
Supersedes the earlier multiplicative spread tuning: near-pinpoint stationary ECHO/KILO fire, with substantial additive angular penalties for movement, sliding and airborne fire. MICA retains a pellet cone and receives the same state penalties. Actual emitted rays are regression-tested across all four states and all guns. The shotgun reticle alone is capped at 38 px radius; damage/hit testing retain the full spread. HUD spread uses the current predicted locomotion state.
The intro now starts after the first gameplay render and lasts seven seconds (about six at full opacity); MATCH START remains for the first two seconds. Restored illustrated graphics previews, clearer keyboard keycaps, a brighter Play Online button, restrained card border and right-aligned version footer. Protocol 21 requires both services to update.
