# Online rooms: protocol 6

The browser now connects to the Node room service. Create/join controls, local movement prediction, server reconciliation, remote-player smoothing, authoritative combat events, spawn selection and connection/result screens are wired. Public Quick Play and private invitations are supported; ranked matching and regional routing are not.

## Play locally

Requires Node 22.13+ (tested on 26.4.0). Run the frontend and room server in separate terminals:

```sh
npm run dev -- --host 0.0.0.0 --port 3001
npm run server
```

Open `http://localhost:3001/`. Choose mode/map/primary, then **ONLINE → CREATE ROOM**. In a second browser instance, choose a primary, open **ONLINE**, enter the room code and join. The joining client uses the room's mode/map. Both players have to reach the same room service. Private rooms wait for host start and player readiness; public rooms start with one human and bot backfill. Opening the menu does not pause online time, opponents or incoming damage.

The service listens on `ws://127.0.0.1:3002/play`; `GET /health` reports protocol/readiness. The browser defaults to that local endpoint. Configure `NEXT_PUBLIC_ROOM_URL` for a frontend deployment, or enter an explicit endpoint under **Server address**. HTTPS pages require WSS. `KRAGE_HOST`, `KRAGE_PORT` and comma-separated `KRAGE_ORIGINS` configure the room service. It is a long-lived Node process, separate from the frontend's Workers build; the existing Sites deployment does not host it. External play needs a chosen server host, TLS termination and explicit allowed origins. The user has deployed the frontend and room service on Render; this local protocol update still requires redeployment.

Room codes are unlisted invitations, not account authentication. Origin checks are not authentication either. Weapon finishes remain local presentation. Operator selection is transmitted; team modes assign distinct team models. Online matches do not award practice marks.

## Wire messages

Create: `{"type":"create","mode":1,"map":0,"name":"PLAYER","primary":1}`.
Modes 0/1/2/3 are FFA/1v1/2v2/3v3; maps 0/1 are Dune/Snow; capacities are 8/2/4/6.

Join: `{"type":"join","room":"ABC123","name":"FRIEND","primary":0}`.
Welcome returns protocol 6, room, actor ID, private reconnect token, 120 Hz simulation and 20 Hz snapshots. A newly joined player receives the selected primary plus EDGE. Dead players send `{"type":"deploy","primary":2}`; the server checks the timer and changes the life generation before spawning. Old-life inputs are rejected when a life value is supplied.

Input example:

```json
{"type":"input","seq":7,"life":0,"forward":1,"right":0,"yaw":0,"pitch":0,"fire":false,"ads":false,"jump":false,"slide":false,"crouch":false,"reload":false,"weapon":-1}
```

The browser sends complete input state at 60 Hz. Each queued frame covers two 120 Hz simulation steps; the server still controls elapsed simulation time. Yaw/pitch are base aim radians, with authoritative recoil added server-side. Weapon -1 is no request. Jump/slide require release before retriggering; reload/switch requests are consumed once. Movement/pitch are bounded, non-finite numbers rejected and repeated sequences ignored. The queue is capped at 16 frames. After 250 ms without updates input becomes neutral and the queue clears. No client position, damage, health or frag claim is accepted.

Snapshots acknowledge the last fully applied frame (`ack`), plus the currently partially applied frame and its remaining steps. They include tick/time, life, authoritative actors, scores, room state and outcome. A bounded sequenced event log carries shots/hits/deaths. Transport sends each event once per connection; the client also de-duplicates IDs. New connections skip historical feedback. Reconnect can replay recent missed events within the 256-event window; it is not a durable replay system.

The browser maps its server actor ID to local presentation ID zero and maps its own team to HUD team zero. It restores authoritative local movement, replays unapplied steps and preserves current mouse aim. Remote transforms use a bounded 100 ms server-time interpolation buffer, reset on spawn/occupant changes. Prediction stores at most 90 frames. Local weapon sounds, recoil, ammo, reload and equip predict immediately and reconcile to authoritative snapshots. Confirmed shot events carry input sequence/life identifiers to prevent duplicate feedback. Damage and kills remain server-confirmed.

Inputs optionally include `viewTick`, the rendered server tick. Hitscan checks historical target poses with a maximum 200 ms look-back, never across respawns. Static cover still blocks shots; melee uses current positions. This is bounded lag compensation, not complete competitive netcode or anti-cheat. Settings diagnostics expose frame p95, draw calls, model rebuilds, RTT/jitter, server step time and input queue depths.

## Reconnect and resource boundaries

The client keeps its reconnect token in memory, sends pings, reports round-trip time and attempts to rejoin after an unexpected socket close. The server reserves a disconnected slot for 30 seconds. A page reload or deliberate Leave discards the in-memory client token. Rooms are not persisted across server restart. Full reload/HMR therefore does not resume an old room.

Limits: 32 rooms, 256 peers, 2 KB inbound messages, 120 messages per peer per second, 256 KB outbound buffer, heartbeat checks, 60-second empty-room expiry. Compression is disabled. These are bounds, not load-tested capacity. No account/IP quotas, multi-region routing or durable rematches exist. Public matching only searches compatible rooms on this server. The first alpha returns to the lobby after a round.

## Economy adapter

`server/economy.mjs` contains the separate SQLite adapter: profiles, unique ledger events and payment-receipt keys. Transactions atomically apply rewards/purchases/claims. Server profiles start at zero. Paid grants are disabled. The adapter still has no account endpoint and is not attached to room completion. Add authenticated IDs, durable server-result settlement, migrations and backups before exposing online balances. Never accept device-local balances or browser-submitted match results. Future payment verification/refunds/reconciliation remain unimplemented.

## Verification

Backend/network tests cover bounded controls/replays, deployment, two actual sockets sharing state/reconnecting, transactional economy operations, held/stale controls, recipient-specific outcomes, half-applied prediction frames, second-player identity/death/spawn mapping, and delayed input delivery. Delay simulation uses 50/100/150 ms inbound delay; it is not a WAN benchmark or a bidirectional jitter/loss test.

Browser verification joined ALPHA and BRAVO into one 1v1 Foundry room, showed both local perspectives, accepted crouch/weapon changes, recorded a server-confirmed elimination with matching death recap, and deployed BRAVO with TWIN after selecting it. Embedded pointer lock was blocked; interaction used drag aim. Live reconnect under a physical network outage, sustained internet play and online result-screen visuals still need testing.

Next: human network playtests, measured correction smoothing and jitter/loss testing; then accounts and durable match settlement. Keep those separate from claims of complete anti-cheat or production readiness.


## Public quick play
`quick` accepts the same mode/map/primary/operator/duration/capacity fields as creation. It joins an available public room with matching settings, or creates one. Server-controlled casual bots fill empty positions; arriving humans replace bots. Disconnected slots remain reserved for 30 seconds, then refill with a bot. Bots are explicitly labelled. Private room codes still work. Deploy frontend and room server together.

Room durations: 60/180/300/600 seconds. FFA capacity: 2/4/6/8; team capacities follow mode. Team characters are assigned by team for readability. Public rooms run with one human; empty rooms pause and expire. There is no ranked matching, regional routing or cross-server room directory yet.

Protocol 4 requires matching clients/server: slide decay, shared landing dip, and stance/landing interpolation changed.

## Friend lobbies
Protocol 5 adds staging snapshots with host, ready flags, character/loadout and validated match rules. The main Play Online action requests Quick Play directly. Friends / Custom opens a separate lobby panel. Create options: mode, map, duration (60/180/300/600 seconds), score limit (10/20/30/50/100), FFA slots (2/4/6/8), bot fill and difficulty. Rules are selected before creation and shown in the waiting room.

During staging, clients send `lobby` messages with primary/operator/ready. Loadout changes clear readiness; team modes retain team-assigned characters. Only the connected host may send `start`, and all connected humans must be ready. Without bots, two humans are required. Host ownership transfers when the host disconnects. Invalid lobby actions report recoverable errors. Player names persist on the device; this is not authenticated identity.

The party canvas renders the actual player rigs and carried weapons from server snapshots. Rendered preview quality is not covered by socket tests. Both services must be redeployed together and existing tabs refreshed.

## EDGE contact
Primary fire starts a 300 ms slash (1.95 m sweep); secondary/ADS input with EDGE starts a 480 ms stab (2.65 m). They share a cooldown. Damage resolves once, on the server, 90/150 ms after attack start against current positions and cover. Switching or dying cancels pending contact. Shot events predict swing audio; melee-contact events confirm impact separately. Client and server must run protocol 6 together.

## v0.5
Current release requires protocol 7 on both services. Private-room hosts can return the same party to staging after results; players must ready up again. See V0.5.md for release checks.
