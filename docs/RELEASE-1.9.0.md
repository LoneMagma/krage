# KRAGE 1.9.0

Combines the planned movement build with the former 1.10 character/weapon refinement scope.

## Movement and presentation
- Shared 0.9 m footfall cadence for gait and audio replaces the rapid leg shuffle and unrelated 1.65 m audio interval. Longer ground strokes, lower swing lift and crouch-aware lift retain analytical leg IK and planted feet.
- Continuous hip heading across forward/strafe/backward transitions removes the diagonal direction flip. Reset animation history on respawn/time discontinuities to avoid stale inertia.
- Remote velocity, grounded/crouched state and slide state now use the same buffered timeline as position and stance blends. Local prediction, server authority and room protocol are unchanged.
- Small bounded weapon inertia follows acceleration and settles at rest. ADS suppresses it entirely; camera rays, damage and input response are unchanged.
- Existing air steering, jump/slide buffers, landing compression and crouch collision were retained after inspection rather than rewritten.

## Character and weapon identity
Five block characters retain shared joints/hit volumes, with varied torso/backpack profiles, shoulder pieces, boots and small functional equipment details. Existing finishes follow the modified geometry. Character geometry remains under the existing 900-triangle test budget.

ECHO receiver details, KILO receiver/foregrip details and MICA side plates refine the existing silhouettes without obstructing sights. Primaries have weapon-specific support-hand anchors; EDGE uses a free off-hand rather than a two-handed rifle pose. The MICA first-person size/arm fix and all 1.8 audio revisions remain included.

## Validation and limits
Core/presentation tests cover cadence, planted feet at multiple frame rates, directional continuity, remote pose timing, inertia bounds/ADS suppression, character geometry and MICA aim clearance. Lint, TypeScript, room-server regressions and production build are run for release. A static browser lineup was inspected. This is not a live multi-device playtest or a certified low-end FPS benchmark; subjective movement feel should be checked in a human match.

No database migration, new dependency, balance change or paid service is required. Deploy the frontend; room protocol remains 22.
