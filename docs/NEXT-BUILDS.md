# KRAGE: next builds after 1.6

Planning only. Based on the user's priorities in convo.txt, checked against the current code. The quoted assistant's claims are suggestions, not verified findings or permission to implement new features.

## What matters
The useful common diagnosis is disconnected feedback and weak visual hierarchy, not a shortage of effects or assets. Preserve the lobby/navigation architecture, the block-built character style and both Cells. Improve timing, readability and intentional choices within those constraints.

Grok's animation prescription is too aggressive for this project: the player previously asked to reduce wobble. The code already has IK, distance-based gait, landing response, weapon recoil/sway and capped camera motion. Tune these together instead of adding another stack. Critically damped springs do not produce overshoot; add underdamping only where deliberate. Keep visual motion out of simulation, aim rays, input handling and hitboxes. Good animation must not add a delay before jumping or sliding.

Sound generation quality does not determine playback latency. Trim leading silence, preload/decode, trigger from the correct event, and reconcile predicted/server events without double-playing. The existing audio module already distinguishes weapons, reload phases and several feedback effects. A synchronized mix and consistent transient/tail treatment matter more than increasing the sound count. Generate only missing replacements after testing edited existing clips in context.

UI should be visual-first, not label-free. Icons still need short labels, keyboard hints and accessible names; color must not be the only distinction. Major state changes deserve focused screens, but routine purchases, minor errors and kills need not interrupt play with a modal. X/Escape closes optional screens; it must not bypass pending account decisions or hide an unresolved disconnect. Preserve the current lobby placement and moderate corner treatment; do not infer a mandate to make everything angular or bright orange.

Dust 2/Inferno offer lessons in landmarks, route timing and controlled exposure. Their objective-based layouts are not templates for a small frag arena. Dune and Snow need their own spawn/rotation logic, flank costs and encounter rhythm, measured with people and bots. More cover or a larger footprint is not automatically better.

## Version sequence and exit criteria

### 1.7: visual identity and state screens
Keep current navigation, preview placement and lobby architecture. Establish shared surface/color/type/button tokens; one display face and one UI face. Make Play Online the clearest CTA, chat easily discoverable and secondary actions quieter. Design coherent victory/defeat, respawn, match entry, removal/disconnect and account-conflict screens. Use short action-led messages and consistent X/Escape behavior. Purchases use an inline item reveal/confirmation; recoverable local errors stay near the control. Respect reduced motion and smaller viewports without page scrolling.
Exit: a new player can find play, chat, locker and lobby without explanation; no overlapping controls; keyboard navigation and network/error states verified. Do not add new gameplay or maps.

### 1.8: sound identity and event timing
Define a compact sound palette: short dry mechanical weapon attacks, restrained low/mid kill confirmation, soft physical movement, clean minimal UI tones. ECHO is tight and quick, KILO heavier and metallic, MICA broad with a short low tail, EDGE cuts/swishes with clear impact. Audit each current sound in actual gameplay, trim/remix/replace selectively, match perceived loudness, cap voices and preserve useful opponent cues. Reload sounds follow visible contact phases, movement sounds follow contact, and headshot/kill cues remain distinct without stacking harshly. Add very quiet dry-wind/cold-wind map ambience only after combat stays clear.
Exit: no duplicate or delayed events in online prediction/reconciliation; rapid fire, reload cancellation, mute/volume, weak PCs and browser resume all tested. ElevenLabs can produce candidate assets; MCP is a convenience, not a mixing or timing solution. No runtime AI generation or required paid connector.

### 1.9: locomotion and weapon feel
Improve planted feet, forward/back/strafe blending, landing compression/recovery and jump/slide transition continuity. Put most weight/inertia into the body and weapon, with a stable aiming camera and motion scaling. Match physical speed and visual cadence, including remote interpolation. Give weapon classes distinct handling without changing where sight/crosshair shots land. Preserve immediate inputs and controllable air movement.
Exit: repeatable movement routes, no crab stepping/foot skating, no added input delay, aim agreement in ADS, and stable results across tested frame rates. Compare reduced/full motion with players before adding stronger feedback.

### 1.10: character and weapon identity
Retain block construction and shared animation compatibility. Differentiate characters through head/helmet silhouette, hair/face arrangement, torso construction, boots and purposeful equipment, not palette alone. Keep competitive collision/hit volumes consistent and readable. Refine weapon silhouettes and handling anchors so ECHO, KILO, MICA and EDGE read instantly; ensure all skins fit the refined geometry. Finish one character as the reference before adapting the rest.
Exit: distinguish operators/weapons in grayscale and at combat distance, no aim/hitbox advantage, no clipping across locomotion/reloads, and no major draw-call increase. Not a cosmetic shop expansion yet.

### 1.11: Dune route redesign
Build a recognizable desert utility settlement: a pump courtyard, shaded market/service passage and elevated reservoir route, joined by intentional flanks. Use unequal but balanced route options, two exits from spawn pockets, bounded long sightlines, recognizable orientation landmarks and a contested position with exposed access. Remove redundant props first; add sandstone, pipes, awnings and equipment only where they explain space. Keep the distant settlement visually separate from playable routes.
Exit: test a graybox with 2–6 humans before art; review spawn deaths, idle travel time, popular/unused routes, camping and shotgun/rifle opportunity. No copied CS layout and no arbitrary size increase.

### 1.12: Snow route redesign and cold atmosphere
Use a compact alpine relay/research station with a central heated warehouse, outer snow trench and raised service gantry. Give the warehouse distinct entrances and purposeful interior cover; open obstructed encounter areas before enlarging the footprint. Ice/snow buildup, insulated equipment, cold exterior light and warmer interiors communicate climate. Place mountains and aurora beyond a clear playable boundary; retain contrast around enemies and avoid fog/particles that obscure fights.
Exit: a route structure and encounter rhythm visibly different from Dune, safe spawn exits, no decorative collision surprises, and measured performance on the target low-end device. Both Cells remain intact except bug fixes.

## Release discipline
Finish and verify one build at a time. v1.6 must first pass live provider, cross-device and persistent-volume checks. Then v1.7 starts with one screen/component sample before a full UI pass. Do not add payments, new modes, expensive skins or more effects to compensate for a weak core loop. These stay outside the sequence until the existing game is coherent and fun.

Source for optional audio tooling: https://github.com/elevenlabs/elevenlabs-mcp (official MCP); https://elevenlabs.io/docs/eleven-api/guides/cookbooks/sound-effects (official SFX API).
