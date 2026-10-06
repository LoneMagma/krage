# KRAGE 1.4.0 - developer handoff

## Runtime and structure

React 19 + TypeScript, Three.js rendering, vinext/Vite frontend, and a separate Node WebSocket room service. Node 22.13+ is required (including `node:sqlite`). The browser runs practice locally; online simulation is server-authoritative. No engine migration is required.

- `app/page.tsx`: lobby, settings, HUD, loadout, death/results, shortcuts and saved preferences.
- `app/v07.css`: current visual overrides, including v1 screens. `app/globals.css` remains the older foundation; check specificity when changing layouts.
- `components/game/`: locker inspector, character/party previews, custom-room controls, challenges, chat and key binding UI.
- `lib/game/core.ts`: shared 120 Hz movement, collisions, guns, damage, spawning and bots. Both practice and room builds consume it.
- `engine.ts`: input, renderer lifecycle, camera/weapon presentation, feedback, audio and online handoff. `graphics.ts`: block characters, weapons, finishes and batching. `animation.ts`, `motion.ts`, `ragdoll.ts`: procedural poses/camera/body simulation.
- `maps/`: Dune, Snow and facility rendering. `network-state.ts`, `remote-buffer.ts`, `weapon-feedback.ts`, `room-client.ts`: prediction/reconciliation, interpolation, immediate local weapon feedback and transport.
- `server/index.mjs`, `rooms.mjs`, `lag-history.mjs`: socket validation, matchmaking, authoritative matches and bounded hit rewind. `server/economy.mjs`: SQLite economy foundation, not a public account/payment API.

## Current game

Four modes: FFA, 1v1, 2v2, 3v3. Dune is a desert settlement with routes/terraces; Snow is an alpine facility with gallery, freight and service passage. CELL I and CELL II are compact open-sky training arenas. Shared collision blocks define solid props; decorative scenery is batched separately. Cells now use brighter sage/sand and blue/slate palettes, distinct from Snow.

Rook, Vera and Blake use original block-built bodies, facial accents and small personal gear. Joint topology and hitboxes stay consistent across models. Team modes assign recognizable team models. Foot plants, tucked weapon grips, air/landing poses and ragdolls share the rig. The lobby uses a shallow, rimmed presentation base and drag rotation.

ECHO: 35 rounds, 1.50 s reload. KILO: 25 rounds, 1.90 s reload. MICA: two shots, ten 17-damage pellets, 42-unit maximum range, 0.059 spread, 2.05 s reload; distance falloff still applies. Shots are immediate collision-tested rays; tracers are presentation, not separate projectiles. The shotgun's bead tip is aligned at local view Y=0.075; first-person placement keeps its stock away from the near plane.

EDGE left-click alternates diagonal slashes (0.30 s cycle, contact at 0.09 s). Right-click stabs (0.62 s cycle, contact at 0.15 s), including a longer return/recovery. Damage checks the target and cover at contact, not button-down.

WASD steers on the ground and in air. Jump launch is 8.8 with gravity 30; buffering/coyote timing remains shared. Crouch is hold-only. Slide is a separate bindable action (default C), buffers briefly before landing, and lasts 0.55 s with momentum decay. Jumping cancels the old slide cooldown so landing can flow into another slide. A soft slide sound triggers locally during the movement, rather than waiting for network events. Gunfire uses the supplied samples; reload/impact/UI sounds and procedural fallback audio remain in `audio.ts`. Music/SFX settings persist.

## Multiplayer contract

**Protocol 17: deploy frontend and rooms together.** Server simulation is 120 Hz, input frames 60 Hz, snapshots 20 Hz. Prediction uses the same movement functions; remote actors interpolate buffered snapshots. Rewind is bounded to 200 ms. Server-side input validation, bounded queues and stale-input neutralization remain enabled.

Quick Play ignores private map/mode/time preferences and fills an available public room before allocating another. Public FFA/3v3 rooms hold six; 2v2 holds four. Vacant slots use casual, normal and hard bots. Human joins replace bots. Public rounds are five minutes/30 frags, alternate Dune/Snow and cycle FFA → 2v2 → 3v3. A party larger than four skips 2v2 rather than dropping players. Eight seconds after results, the same room/token sessions enter the next round; names and loadouts persist, scores reset for the new round. Clients rebuild prediction and scenery on the new round ID. The result screen announces the next arena/mode/countdown.

Custom rooms retain host-selected rules, staging, ready checks and explicit rematches. Public automation does not change private games. Reconnects retain the existing session and score for 120 seconds within a round. A room-process restart loses in-memory matches. Global/match/team chat remains available with bounded messages and server routing.

Entry no longer requires an extra ready panel. A short room/map/mode banner fades over play. Quick Play requests pointer capture from the initiating gesture; if the browser refuses, the game remains entered and shows a click-to-capture cue. Escape still intentionally pauses locally; online matches continue.

## UI, skins and KR

Results show outcome, score, frags/deaths/KR and actions. Respawn offers three weapons and Space; 1/2/3 choose a spawn loadout. Enter restarts practice after results, Tab toggles results scores, Escape exits results. Lobby loadout accepts 1/2/3 and Escape. Locker arrows cycle finishes; equipped ownership rules remain enforced.

Circuit/Blackout/Nightfall cost 750/900/1000 KR. Premium Glacier (formerly Corona)/Regent/Nebula cost 2800/3200/3600. Nebula uses dark steel, platinum panels and pale gold inlays, distinct from Nightfall's muted purple accents. Retired original Glacier/Copperhead/Amethyst purchases are refunded once on profile refresh; equipped retired finishes revert to Factory. Corona's internal ID stays stable to preserve ownership.

Completed eligible matches award 5–15 KR. Challenges are the main earning path: three daily and four weekly, unique objective metrics per set, selected deterministically from authored decks. UTC midnight resets daily; Monday UTC resets weekly. Boundary timers and visibility/focus refresh update an open or suspended tab. Claims, set bonuses, match receipts and purchase receipts are idempotent. Profile data uses `krage-practice-v1` local storage; it is device-local and not a trusted competitive or paid balance. Authentication, cross-device economy and real-money credits remain unwired.

## Build, verification and deployment

`npm ci`, `npm test`, `npm run test:server`, `npm run lint`, `npx tsc --noEmit`, `npm run build:render`. Start the frontend with `npm run start:render`; build rooms with `npm run build:server`, run `node server/index.mjs`. If system libvips conflicts with Sharp, install using `SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm ci`.

Set `NEXT_PUBLIC_ROOM_URL` at frontend build time and exact `KRAGE_ORIGINS` on the room service. `/health` must return protocol 17. Keep one room-service instance until shared room routing/state exists. See `docs/DEPLOY.md` for deployment commands; this work does not publish either service.

Regression coverage includes shared movement/prediction, jump-to-slide, attack timing, collisions, rig/geometry budgets, cosmetic migration, challenge rollover/idempotency, live WebSocket joining, full-room overflow, public rotation, private isolation and reconnect score retention. Browser checks cover map spacing, left-side practice controls, locker arrows, weekly challenge fit, weapon sight placement and result/respawn layouts. Local software-rendered browser FPS is not a hardware benchmark. Deployed latency and low-end-device comfort still require real-device testing; source checks cannot certify those.


## 1.2 update: movement, bots, party and cosmetics

- Distance-driven locomotion lives in `locomotion.ts`. Graphics blend local travel direction and lower-body yaw independently of aim, use bounded leg IK and world-space foot contacts, and retain shared jump/slide/landing state. No external animation service or new runtime dependency is required.
- Bots keep difficulty separate from assault/flanker/anchor roles. Aim has persistent error and bounded pitch/yaw tracking; bots receive recoil and pause between bursts. Authored patrol locations are swept instead of randomly revisiting corners. Cover/flank decisions use visible or last-seen information. Low obstacles and occasional evasions trigger real shared jump/slide inputs, with six-to-ten-second traversal cooldowns.
- Custom rooms use a shared character stage and real-player invite slots. Map/mode are primary controls; Match Settings replaces the stage with Rules/Bots/Loadout while open. The panel fits the viewport without scrolling. Live weapons, character choices, readiness and reconnect state use authoritative room snapshots.
- Sable and Flint join Rook/Vera/Blake. Each has distinct block-built equipment and identical hitboxes. All five rigs remain below 900 body triangles. Signal, Ivory and Tundra are earned finishes (1250/1450/1600 KR); EDGE Talon is a 2400-KR curved blade with a finger ring and dedicated preview orientation. Talon keeps factory damage/range/cadence. Per-weapon cosmetic arrays now include EDGE; protocol 16 bounds cosmetic IDs and preserves them across reconnects/public rounds. Appearance IDs are cosmetic only, not proof of paid ownership.
- Locker framing enlarges KILO relative to ECHO and presents EDGE upright. Settings show actual scene/crosshair illustrations. Brand title is KRAGE. The footer retains the existing version and India/pacify credit; extra guide links/pages were removed at user request. Root metadata/sitemap/robots remain; the 1200×630 social image is rendered from the actual Dune map.
- Enter opens chat; Enter sends and Escape closes. Incoming Unicode text appears lower-left and fades after 6.5 seconds, with up to four recent lines. Chat has bounded history, channel selection, mute and global-socket retry. Existing server rate limits and room/team isolation remain. Chat does not pause an online match.

Verification: shared simulation/presentation tests, real WebSocket regressions, lint, TypeScript and Render build. Browser checks cover 1366×768, 1280×720, 1024×600 and 750×650 lobby/settings fits, locker orientation, five rig silhouettes, room creation and chat. Software-rendered Chromium is not a low-end hardware or internet-latency benchmark. Deploy frontend and room server together for protocol 16; no deployment or payments are performed by this update.

Final verification (2026-09-24): 61 simulation, 42 presentation and 33 server tests pass (136 total), plus lint, TypeScript and the production build. Two production-browser clients verified Enter-to-open/send, Unicode delivery and automatic chat expiry, private room joining, live character sync, ready checks and authoritative match start. No public deployment was performed.


## 1.3 update: live lobbies and themed environments

- `PartyPreview` renders four compact live character cards per page using one renderer and per-card cameras/scissor rectangles. Drag or arrow keys rotate each model. Outfits, weapons, readiness, names and host crown reflect snapshots. Slots five through eight use page arrows. Host removal requires an inline second click.
- Browse is the initial Lobby view. Custom rooms publish map/mode/time/score, live human count, capacity and password status; public matchmaking and invite-only rooms are excluded. Listings refresh every five seconds while visible. Create → Match Settings → Access controls discoverability and an optional password. Code/invite joining supports passwords without putting secrets in URLs.
- Server `rooms` and `kick` messages are validated at the room service. Only the connected host can remove another player; removal revokes the session token and explicitly stops reconnect. Existing host handover/start/rematch permissions remain. Passwords use salted asynchronous scrypt with timing-safe comparison; plaintext/hashes never enter room snapshots/listings. Authentication work is capped at eight concurrent requests. Connected peers have message and join-attempt limits. This remains an anonymous lobby system, not durable bans or account authentication.
- `maps/backdrops.ts` contains merged static art outside playable bounds: Dune aqueduct/settlement/palms; Snow observatory/cable route/glacier shelves; CELL I freight district/gantry; CELL II coastal dock/water/lighthouse. Existing Dune dunes and Snow mountains remain. Snow adds a directional aurora curtain in its existing single-pass sky shader. Cell skies have independent color choices. Snow frosted panels and Cell concrete/brick textures use deterministic mipmapped procedural surfaces; collision geometry is unchanged.
- Locomotion now completes a stride in approximately 0.91 metres rather than 2.33, matching the feet's available reach and preventing repeated early releases. Forward/backward motion retains world-space foot plants and aim-independent hips; subtle torso weight and a slightly lifted backward recovery replace the excessive moving squat.
- Local verification: 61 simulation + 44 presentation + 36 room tests (141 total), TypeScript, lint and Render build. Browser checks cover password join and host kick with two clients, live player cards and 1366×768 / 1024×600 / 750×650 layout bounds. Four map renders were inspected; 21–77 draw calls, 2,284–10,970 triangles for the sampled scenes (not a hardware FPS benchmark). Actual internet latency is unaffected by scene-art changes and requires deployed testing.

Deploy the frontend and room service together with protocol 17; refresh old tabs. No remote deployment was performed. Password lobbies and directory state live in room-server memory and reset when it restarts.

## 1.4.0 combat and presentation patch

See [release details](RELEASE-1.4.0.md) for current gun balance, EDGE timing, horizon/aurora changes, confirmation audio and the default quick-play entry. This supersedes previous combat constants above. Deploy frontend and rooms together with protocol 21.

## 1.4.0 economy and final presentation
Current constants, map changes, skin prices, migration behavior and verification are in [RELEASE-1.4.0.md](RELEASE-1.4.0.md). Hit-marker batching lives in `weapon-feedback.ts`; per-frame opacity/scale uses HUD CSS variables without React updates. Weapon silhouettes are shared through `WeaponGlyph`. No new public queues or authentication provider were deployed.
