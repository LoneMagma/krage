# v1.10.2

Mobile editor: compact central size controls, Save, and optional advanced controls. Select buttons directly and drag them. Opacity, sensitivity, gyro, left-hand preset and reset sit under Options. Existing saved layouts remain compatible. Editor prevents gameplay input.

Mobile UI: compact navigation with bespoke KRAGE SVG lettering; scrollable bounded settings/account/lobby panels; health/ammo above touch zones; centered chat composer and thinner custom scrollbars. Settings categories separated visually. Lobby creation keeps map/mode upfront with advanced rules under More Options. Invite placeholder now creates a lobby rather than merely revealing settings. Locker shows preview/status hints.

Account panel uses the same local Icofy-derived name avatar as lobby/chat/scoreboard. Chat names, avatars and messages align inline. Tab key release no longer hides a scoreboard toggled open after match end. Versions updated; room protocol remains 23.

Preserved: combat tuning, operator pricing, account migrations and economy. Background animation, movement polish and the requested Rook/Vera/Sable/Flint/Blake pricing order belong to the next pass.

Real mobile hardware testing remains required for browser orientation/gyro behavior and long-session performance. Emulation does not establish real-device FPS or internet latency.

Validation: 133 core/presentation tests, lint, TypeScript and production build passed. Added a default-control overlap regression for 667×375, 844×390 and 1024×768. Browser smoke covers map cards, practice entry, multi-touch cancellation and editor drag/save. No production deployment was performed.
