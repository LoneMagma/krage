# KRAGE v1.4.0 · Four arenas

Browser arena FPS with public Quick Play, private friend rooms and practice bots. Three primaries, one blade, four modes and four arenas. Built with Three.js, TypeScript, React and Vinext. Characters use simple articulated blocks; weapons use lightweight angular Three.js meshes. Audio combines the original v0.6 gunfire with edited supplied effects.

This v1.3 build requires frontend and room server protocol 18. See [developer handoff](docs/DEVELOPMENT.md) and [Render deployment instructions](docs/DEPLOY.md).

## Play

Run `npm run dev` and open the printed local address. The current preview uses http://localhost:3001/.

Choose Free for all, 1v1, 2v2 or 3v3, an arena, a primary and bot difficulty. FFA allows zero to seven bots; zero is an empty warmup. Targets difficulty creates stationary opponents that do not shoot. After each death, choose a primary and click Deploy when the two-second countdown finishes. The match continues during selection.

| Input              | Action                                              |
| ------------------ | --------------------------------------------------- |
| WASD / mouse       | Move / look                                         |
| Left / right mouse | Fire / aim                                          |
| Space              | Jump; release and press for the next jump           |
| Shift              | Hold crouch; release to stand  |
| C                  | Slide; independently rebindable |
| R                  | Reload                                              |
| 1 / 2              | Your primary / blade                                |
| Q or wheel         | Toggle primary and blade                            |
| Tab / Escape       | Scores / pause                                      |

Touch controls are included. WebGL 2 is required. If an embedded browser blocks mouse capture, choose **Play with drag aim** on the pause screen, or open the game in a full browser tab for unrestricted mouse look. In drag mode, hold a mouse button while moving to look; I/J/K/L also turn the camera. On the spawn screen, 1/2/3 select a primary and Space/Enter deploys.

## Private rooms

Run `npm run server` alongside the frontend. Choose a mode/map/primary, open **ONLINE**, create a room, and have a second client join its code on the same server. The room simulates when two players are connected. Menus do not pause online rounds. See [connection setup and limits](docs/MULTIPLAYER.md) for external-host configuration and current latency limitations. No public room service is deployed.

## Rules

First to 20 frags or most frags after five minutes wins; equal frags draw. Team modes share a frag total. Frags earn 100 points; headshot finishes add 50. Points do not break match ties. Teammates block shots but take no friendly damage. Spawn protection lasts 1.6 seconds and ends on firing. Health regenerates after five seconds without damage. Reserve magazines are unlimited; switching to melee interrupts a reload. Only the selected primary and blade can be equipped.

## What's changed

The v0.4 pass fixes EDGE contact, adds a timed lower/swap/raise weapon transition, refines slide steering and stair contact, improves ragdoll collision, and separates weapon/action/material sounds. Both maps have added architectural detail and clearer palettes. The new logo, lobby, weapon illustrations, death recap and result screens share one visual language.

The locker offers three operator variants and three weapon finishes. Two operators are free. Local practice marks unlock cosmetics; authored daily and weekly challenges rotate on UTC boundaries. The account is saved on this device and is not a secure or paid wallet. No cash purchases exist.

The ONLINE menu now creates and joins authoritative rooms through a separate Node WebSocket service. The browser predicts local movement, reconciles server state, smooths remote players and receives confirmed combat/death events. A transactional SQLite economy adapter keeps earned and future paid balances separate, but it is not attached to authenticated accounts. Online rounds do not earn practice marks.

See [the v0.4 audit](docs/V0.4-AUDIT.md), [server setup and protocol](docs/MULTIPLAYER.md), and [comparison and positioning](docs/COMPETITOR-AUDIT.md). Earlier [v0.3 findings](docs/V0.3-AUDIT.md) remain historical context.

## Development and verification

Node 22.13+ is required. `npm install` installs dependencies. On systems where local libvips breaks Sharp installation, use `SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install` for the prebuilt binary.

- `npm test`: 54 checks across simulation, camera alignment, controls, rig handoff, weapon animation and local progression.
- `npm run test:server`: nine checks including two real WebSocket clients and transactional economy operations.
- `npm run server`: start the separate local room service on port 3002.
- `npm run lint`: authored application, gameplay and test files. Unused generated UI components are outside this check.
- `npx tsc --noEmit`: full type check.
- `npm run build`: production build.

`lib/game/core.ts` owns the simulation; `graphics.ts` owns models and maps; `engine.ts` integrates input/rendering; `audio.ts` owns generated sounds; `app/page.tsx` owns the interface.

## Performance and limits

Potato mode reduces resolution and disables shadows, debris and ragdolls. Balanced uses 1× resolution without dynamic shadows; High enables shadows and increases pixel ratio. Antialiasing is disabled to reduce render-target cost. Static map geometry is merged by material. Each animated character segment is batched with vertex colors. Effects and corpses are bounded. The v0.4 browser inspection covered the lobby and locker; a fresh combat benchmark remains unverified after the browser connection was interrupted. The earlier v0.3 run averaged 59.7 FPS at 832 × 868 on Balanced, but that is historical and is not a v0.4 performance claim. Settings includes the local 30-second combat benchmark and preserves its last result on the device.

The default browser mode remains one human with local bots. Private rooms require the room server; matchmaking, production anti-cheat, lag compensation, gamepad input, full control remapping and match-history screens are not implemented. Practice progression stores completed-round receipt IDs, not replayable match history. Crouch and slide keys can be rebound. Ragdolls and character collision are lightweight approximations. Guns use instantaneous ray collision for every round/pellet. Animated streaks visualize those rays; there is no physical bullet travel, gravity, penetration or ricochet simulation. Optional WebMCP status/pause tools depend on experimental browser support; status retrieval was verified in the embedded preview.

The source remains in the existing `rift` directory to preserve the running workspace and preview paths; the product identity is krage. Publishing is paused pending the previously requested explicit source-export approval.

The dependency audit currently reports 11 framework/dependency entries, including eight high-severity advisories. The direct room dependency is ws 8.21.1; older nested dependencies still need a compatibility-tested update before public deployment. The production build also warns about a large client chunk. See the audit for the full readiness boundary.
