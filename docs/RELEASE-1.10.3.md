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
