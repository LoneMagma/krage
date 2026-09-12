# Next direction

## Confirmed deployment finding
The deployed page-DUsJ6wnU.js bundle compared cached character variants against `actor.operator ?? 0`, while constructing them using team/local/alternating defaults. These disagree for unoccupied slots, repeatedly rebuilding models during online rendering. Fixed by using one shared modelVariant resolver; regression coverage includes occupied and vacant slots. Actual post-deployment FPS still needs a browser measurement.

Five read-only WebSocket heartbeats to the deployed rooms endpoint measured 408, 308, 414, 413 and 414 ms from the agent host. These are not measurements from the user's device and do not establish whether geography, hosting load or routing dominates. Measure server tick time and client frame stalls separately before changing hosting.

## Implemented locally
Public Quick Play reuses compatible rooms and replaces server bots with joining humans. Private rooms retain codes and invite links. Room options validate mode, map, weapon, character, duration and capacity. Rendering no longer rebuilds characters every frame. Combat updates include 35/25-round magazines, mild disk-distributed spread, crouch accuracy, slide inaccuracy, recoil tuning and shotgun ring. Sound gain now affects lobby music too. Team models and low hit/kill feedback remain distinct.

Redeploy frontend and room server together, then test two real devices. Protocol 3 adds predicted weapon feedback with server correction, a 100 ms remote interpolation buffer and hitscan rewind capped at 200 ms. Spawn changes reset interpolation and invalidate historical hit poses. Settings expose rendering/network diagnostics. Strafe poses follow travel direction and stance animation is independent of stair camera smoothing. Browser performance and WAN playability still require measurement after deployment.

## Priority gates
1. Performance: compare practice/online frame time on the same device. Target stable 60 FPS on a reference modest laptop and at least 30 FPS on the agreed potato device. Record p95 frame time, model rebuild count, draw calls, JS allocation, input queue depth, server tick time, RTT and jitter. Eliminate recurring rebuilds before increasing geometry.
2. Netcode: choose a server region near actual players; use stable compute for active games. Add timestamped interpolation, immediate predicted weapon feedback with authoritative reconciliation, and bounded hit rewind. Do not change simulation rate without consistency tests and measurements.
3. Movement: preserve grounded acceleration and stopping; improve step transitions, jump buffering and landing recovery. Keep crouch/slide/air accuracy tradeoffs legible. Blend aim, reload, movement and equip poses; prevent foot sliding.
4. Visuals: coherent silhouettes, palette and light direction. Use atlases, baked shading and shared geometry before dynamic lights or denser meshes. Keep enemy contrast and map sightlines clear.
5. Sessions: queue by mode/map, replace bots cleanly, retain parties and add rematch/map voting. Delay ranked matchmaking and paid cosmetics until retention and reliability are measured.

## Product position to test
Compact arenas with learnable movement routes; three weapons with clear mastery curves; immediate browser matches with reliable bot backfill. Validate these through repeat play and feedback, not uniqueness claims.

Competitor reading: Krunker's controls/practice guide suggests teaching repeatable movement mastery. Venge's official presentation emphasizes character/loadout identity and easy match joining. These are design lessons, not hands-on performance comparisons.

## Visual and sound quality pass
Recorded weapon fire now replaces synthetic gunshots once decoded. Dune gains sandstone walls/ground, distant mesas, and warmer bounce lighting. Both arenas use a single-draw gradient/cloud sky; wall UVs use world scale and vertex colors darken bases without new dynamic lights. KILO receiver/gas-tube/stock details are batched; reload magazine motion includes rotation and withdrawal. Both operator variants retain the shared combat skeleton, with front/back/arm team accents and pitch-following grip poses.

Lobby selections persist; fullscreen is limited to Play or the explicit fullscreen control. Lobby, selectors and results share clearer surface/selection/focus styling. Duplicate result text/actions are removed. Kill/reload feedback occupies separate slots above the weapon HUD.

This is a local incremental quality pass. Authored skeletal animation, a complete character mesh replacement, online rematch voting and real-device performance/auditory validation remain follow-up work. No Render deployment was performed by this pass.

## Controller and animation pass
Protocol 4 shares exponential slide drag, bounded landing compression and gradual standing collider expansion between practice, prediction and server simulation. Crouch shrinks collision immediately for clearance; expansion requires room overhead and follows posture. Low ceilings clamp both eye and mesh stance.

The existing rig now uses analytical two-bone arms/legs, planted stance feet, blended swing/air poses, knee compression and acceleration-driven torso inertia. Limb velocities carry into ragdoll handoff. IK is bounded (four solves per character render); it plants relative to the actor support plane, not arbitrary terrain/slope sampling.

Camera sway controls bounded strafe/slide roll, small velocity FOV expansion and landing roll vibration. ADS attenuates these effects. The shared eye-height landing dip preserves camera/ray agreement and remains when cosmetic sway is zero. Regression coverage includes limb reach, 20/60/144 FPS planting, low ceilings, landing recovery, ragdoll cloning and center-ray alignment. Actual-device visual feel/performance remains a playtest gate.

## Snow / remaining weapons and online lobby pass
Snow adds layered overcast clouds, a wider mountain/snowcap backdrop, perimeter outposts and conifers beyond playable walls. Existing shared-material batching absorbs the static scenery. ECHO gains receiver, vent and stock hardware; MICA gains receiver/hammer/stock detail and visible moving reload shells. Routes and weapon balance are unchanged.

Direct Quick Play and separate staged friend lobbies now replace the mixed online form. Rules are grouped before creation, names saved locally, and party models/loadouts follow snapshots. Tests cover socket start/reconnect, host authority/transfer, readiness, validation and custom rules. The scene additions and party layout still need actual-device visual/FPS verification.
