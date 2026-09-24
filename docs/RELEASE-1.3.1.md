# KRAGE 1.3.1

## Combat
- ECHO: 20 body damage, 1.75× headshots, 0.084 s shot interval; magazine remains 35.
- KILO: headshot multiplier 2.0×; other gun values unchanged.
- MICA: 12 individually tested pellets at 17 base damage, 1.3× headshots. Centered close-range shots can eliminate full-health players. A horizontal shove applies once per target per blast, below 2 m/s and only inside 10 m; teammates and shields are excluded. Shared server/practice damage and prediction constants remain aligned.
- EDGE: 0.42 s diagonal slash, contact at 0.16 s; 0.84 s stab, contact at 0.22 s. First/third-person models share `edgePose`. Alternating diagonal slashes translate across the view without forward thrust; stabs settle before the next attack. Range is unchanged.

## Presentation and lobbies
- Distant scenery is pushed farther beyond the arena and given softer atmospheric colors. Existing exterior mountains/dunes move back too; playable geometry and collision remain unchanged.
- Snow aurora uses periodic angular curves to remove the wraparound seam, broader connected ribbons, restrained vertical detail and slow drift.
- Original low-register 190 ms kill confirmation replaces the old kill cue. All eliminations use the same quiet signature; standard hit clicks are suppressed when the same event batch confirms a kill. Headshots retain their own feedback. `scripts/make-kill-confirm.mjs` regenerates the mono WAV.
- Kill text and points briefly brighten, stagger and settle above the gun. No new full-screen flash; reduced-motion settings disable the animations.
- The always-visible Default Lobby is a functional quick-play entry. Joining uses the existing authoritative public queue, human joins replace bots, full rooms spill into a new room. Custom listings remain separate; no fabricated human counts are shown.

## Deployment
Deploy both frontend and room service with **protocol 18**, then refresh existing tabs. Install with `npm ci`, build frontend with `npm run build:render`, rooms with `npm run build:server`. Set `NEXT_PUBLIC_ROOM_URL` and `KRAGE_ORIGINS` as described in DEPLOY.md. No remote deployment was performed.

## Verification
143 tests pass: 62 simulation, 45 presentation and 36 server tests. Lint, TypeScript and Render production build pass. Browser smoke checks verified default-lobby joining into a real match, 190 ms mono audio decoding and all four map renders without JavaScript exceptions. The match HUD now displays the actual room frag limit, fixing its old hard-coded 20 label. Software rendering is not a device FPS or deployed latency benchmark.
