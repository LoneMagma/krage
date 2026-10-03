# Release check: 1.10.3

Passed locally: 136 gameplay/presentation tests, 38 room tests, 5 account tests, lint, TypeScript and Render production build. Room coverage includes real WebSocket connections, reconnect/score retention, public room overflow, rotation, passwords, host permissions and countdowns. Account tests verify persisted claims, duplicate reward rejection, concurrent purchases, preferences and reward retry handling. These are automated checks, not a human playtest or live Supabase certification.

Fixed SVG title hydration by rendering one deterministic text child. Corrected frontend lock metadata for vite-plugin-dynamic-import 1.6.0 against registry metadata; clean npm ci succeeds. Server remains independently installable. Docker context excludes secrets, local account data, dependencies and generated artifacts.

Before public release: run a 4–6-player deployed match from India including weaker PCs, tab switching, disconnect/rejoin and rematches. Record RTT and frame time. Confirm MICA feel and actual hit registration. Exercise real Google/email verification, fresh-account guest transfer and explicit existing-account protection; then verify claims, purchases and preferences on a second device. No production credentials or deployment access were used here.

Deploy frontend and room server from this same archive; /health must report protocol 24. Mount persistent storage at KRAGE_ACCOUNT_OUTBOX and back up account data through your database provider. Verify restore using a separate database before relying on backups. Monitor health, restart counts, server logs and failed account-outbox receipts; never log auth tokens. Roll back BOTH services together to the same known-good release; room restarts end current matches. Preserve database and outbox data during rollback. Older 1.9 source archive retained locally as fallback, not certified against later database changes.

Cleanup removes generated previews, superseded release ZIPs and disposable caches only. Original models/audio, development history, database scripts and account data remain.

Mobile addition: see MOBILE.md. Chromium checks passed at 667×375, 844×390 and 1024×768 with no page overflow or browser errors; practice, simultaneous move/fire and touch cancellation passed. Real mobile hardware and deployed-network validation remain outstanding.
