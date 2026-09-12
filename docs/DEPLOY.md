## v0.6.0: deploy frontend and rooms together
This build requires **protocol 9**. Reload existing tabs after both deployments. `/health` must report protocol 9. Matches remain in server memory; restarting the room process ends them.

For players in India, test a **Singapore room-server service**. The existing service region has not been verified. Render cannot move an existing service between regions: create a replacement, set `KRAGE_ORIGINS`, then rebuild the frontend with that service's `NEXT_PUBLIC_ROOM_URL`. Keep one room instance until room routing exists. See [Render regions](https://render.com/docs/regions).

Code changes reduce stale input/snapshot queues and render work; they cannot remove geographic RTT. Compare RTT/jitter, server step time and frame p95 on the actual players' PCs. Do not promise a ping value from local tests.

Reconnects reserve the same token, player and score for 120 seconds. Retry now restores that session rather than joining a fresh match. Expired sessions or a restarted server cannot restore scores. Test repeated disconnections, tab switches and rematches with the deployed build before declaring v1.

## Render commands (current build)
Frontend build: `npm ci && npm run build:render`
Frontend start: `npm run start:render`
Frontend build environment: `NEXT_PUBLIC_ROOM_URL=wss://krage-rooms.onrender.com/play`

Rooms build: `npm ci && npm run build:server`
Rooms start: `node server/index.mjs`
Rooms environment: `KRAGE_ORIGINS=https://krage-frontend-n5rj.onrender.com`
Rooms health path: `/health`. Both processes honor Render's `PORT`.
Redeploy both existing services together; do not use the Wrangler development server as the Render start command.
Play Online joins Quick Play. Friends contains Create Lobby and Join Friends.

# Deploy kRAGE

1. Deploy `Dockerfile.rooms` on a container host with WebSocket support. Route HTTPS to container port **3002**. Set `KRAGE_ORIGINS=https://YOUR-GAME-DOMAIN` (comma-separated, no trailing slashes). Health check: `/health`.
2. Set `NEXT_PUBLIC_ROOM_URL=wss://YOUR-ROOM-HOST/play` when building the frontend. Authenticate Wrangler with your Cloudflare account, then run `npm run deploy:web`. This builds and publishes the existing Workers frontend.
3. Set the room server's `KRAGE_ORIGINS` to the exact deployed frontend origin. For Quick Play, use matching mode/map/time on both devices. For private games, open **FRIENDS**, create a lobby and share its code.

Use one room-server instance for this small deployment: rooms live in memory and restart with the server. The container does not require a database for matches. Quick Play joins public rooms and fills vacancies with server bots; private room codes remain available. Cosmetics remain device-local. Keep the frontend and room server on the same release.


## Current Render deployment
Frontend: https://krage-frontend-n5rj.onrender.com
Room endpoint observed in its deployed bundle: wss://krage-rooms.onrender.com/play

Set room service `KRAGE_ORIGINS=https://krage-frontend-n5rj.onrender.com`. The server reads Render's `PORT` and listens on `0.0.0.0`. Keep one instance until a room directory is added. Redeploy BOTH services for quick play. Probe `/health`, then test two independent browsers joining Quick Play with identical settings. Confirm one shared room, BOT labels replaced by player names, and normal FPS before sharing broadly.

## Protocol 3 update
Redeploy both the frontend and Node room service for this update; old tabs must reload. Weapon prediction confirmations require protocol 3. Verify two separate devices share a Quick Play room, replace bots, and agree on kills. Compare frame p95, model rebuild counts, RTT/jitter and server step time in Settings diagnostics before claiming a latency or FPS improvement.

## Controller update (protocol 4)
Redeploy both services and refresh tabs. Camera sway in Settings controls roll, velocity FOV and landing roll vibration; 0 disables those effects. The small shared landing eye dip remains in the controller to preserve shot alignment.

## Friend lobby update (protocol 5)
Redeploy both frontend and rooms service together. Verify `/health` reports protocol 5, Play Online enters Quick Play, and two devices can create/join a friend room, change loadouts, ready up and start. Check remembered names after refresh.

## EDGE and lobby update (protocol 6)
Deploy the frontend and rooms service together, then reload open tabs. `/health` must report protocol 6. Check left-click slash/right-click stab on two clients and verify no duplicate impact sounds. The lobby now uses persistent sections and a WebGL weapon inspector; confirm it on target mobile and desktop devices.

## v0.5
The v0.5 release used protocol 7 on both services. Private-room hosts can return the same party to staging after results; players must ready up again. See V0.5.md for release checks.

## Previous hardening build
That build used protocol 8 and refresh old tabs. Verify pause/Resume after tab switching, reconnect/rejoin after a dropped link, Space/Enter deployment, and matching movement on two clients. Host location and tier still determine network RTT.
