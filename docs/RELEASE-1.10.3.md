# KRAGE 1.10.3

- Responsive ground acceleration, braking and reversal; slightly stronger bounded air steering and 100ms jump grace. Shared simulation preserves client/server parity.
- Smoother foot travel, less foot lift and hip motion, faster directional animation blending. Reduced camera and weapon landing/bob feedback. Reduced-motion preference disables camera/lobby drift.
- Remote interpolation adjusts playback gently to maintain its buffer and discards stale snapshots. No extrapolation or local aim offset introduced.
- Subtle, map-specific lobby camera drift. Centered map names, clearer selection and darker scrollbars.
- Circular mobile controls with distinct fire icon and immediate held feedback. Pointer capture supports dragging fire to aim, simultaneous movement/fire and cancellation cleanup. Existing saved sizes/opacity/positions remain.
- Colored isometric cube branding with matching SVG/PNG/favicon assets.
- Rook/Vera free; Sable 350 KR, Flint 600 KR, Blake 900 KR. Previous ownership preserved; new profiles receive only free operators. Lobby operator picker uses existing local/account purchase flows.

## Verification and deployment
Automated gameplay, room and account suites, lint, TypeScript, production build and browser touch smoke checks. Browser emulation does not certify real-device touch feel, Safari rotation or deployed network latency. Check those with real devices before public rollout.
Deploy both frontend and room server together: protocol 24. Room restarts end active matches. Source archive excludes secrets, account runtime data and dependencies.

## Final release fixes
- End-of-match scoreboard closes only once, on transition to ended. Tab and the visible Scores/Results button remain stable through subsequent network snapshots. Regression test included in npm test.
- Touch detection includes secondary touch pointers and maxTouchPoints; landscape CSS supports hybrid tablets. Portrait fallback remains because browser fullscreen/orientation restrictions cannot be bypassed. Compact landscape results panels remain scrollable.
- Chat uses aligned identity/message columns, with wrapping for long text. Removed MADE IN INDIA footer tag.
- Updated title and social card to KRAGE | Free Multiplayer Browser FPS. Existing canonical, sitemap and robots routes retained. Verify canonical domain matches production and submit sitemap in Google Search Console after deployment. No ranking guarantees.

## Lobby composition and domain
Current release targets krage.pacify.site; krage.xyz migration is deferred. Lobby maps have distinct elevated camera compositions, smooth settling, restrained drift, map-specific tint and stronger panel contrast. Reduced-motion settings disable drift. Gameplay map geometry and lighting are unchanged. See DOMAIN-KRAGE-PACIFY.md for hosting/auth environment settings.

## Compact interface pass
- Added reusable compact selectors: previous/next value, expandable full option list and keyboard arrows. Existing regular choice controls remain available for practice and other screens.
- Custom room creation now shows one map and mode at a time; rules/bots/loadout/access are collapsible sections. Existing room options and host actions are preserved.
- Settings use a single category selector and compact graphic/crosshair/key choices. Sliders, sound toggles, defaults and performance diagnostics remain accessible.
- Locker separates preview controls, finish choices and a compact equip/purchase action. Removed duplicate finish text and adjusted narrow-screen spacing.
- ECHO SVG reflects the actual skeletal stock, box magazine, receiver and ribbed fore-end.
- Five lobby carry poses with subtle weight shifts and staggered feet. Hand IK remains tied to actual weapon grips; gameplay animation and hitboxes are unchanged.

Selector revision: removed extra previous/next buttons. Shared single menu triggers use uniform sizing, spacing and equal columns; keyboard arrows still change values. Settings fields use matched containers and locker weapon choices have equal dimensions.

Final visual correction: settings categories are visible icon tabs again; graphics, crosshair, difficulty and key choices use aligned visual buttons. Compact menus remain for lobby configuration, including map preview icons. Connected gameplay no longer shows the central room-code/invite banner; latency appears beside performance stats and Copy Invite is available when paused. Waiting/reconnection warnings remain visible. The match intro uses ONLINE MATCH instead of a room code.

## Character poses and locker
Rook retains the two-handed carry. Vera raises her weapon beside the shoulder, Blake carries low with one hand, Sable carries diagonally over the shoulder, and Flint rests an upright weapon on the ground. Lobby poses reset before gameplay animation; hand IK and arm-length constraints remain. Flint's presentation scale is adjusted to keep each primary grounded at a reachable height.

Lobby arrows preview all operators without equipping or purchasing. Locked names display a lock and KR price; clicking opens that character in the locker. The Characters tab includes a rotatable live preview, balance, ownership, explicit Buy and Equip buttons and insufficient-funds state. Purchases use existing guest/account transactions; equipped gameplay cosmetics remain independent of previews. Prior ownership is retained.

Pose revision: Rook and Flint unchanged. Vera uses an upright side hold, Blake a lowered side carry, Sable a diagonal waist carry; free hands rest naturally rather than mirroring the previous hip pose. Locker portraits have dedicated closer framing and more vertical room; descriptive character taglines removed. Movement settings use compact rows and a three-column layout on short landscape screens.
