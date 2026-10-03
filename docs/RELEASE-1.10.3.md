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
