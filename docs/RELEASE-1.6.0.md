# KRAGE 1.6.0

## Integration
- Claims, purchases and loadout selections now use server account commands. Feedback is shown after commit, duplicate clicks are blocked, failures remain retryable, and cloud polling no longer reverses local-only purchases.
- Display names and field-level preference changes persist to the account. Online joins flush pending preferences; saved names update active room actors. Actual keyboard code bindings are accepted. Graphics quality remains device-specific.
- Authentication changes leave the active arena, clear old account state and invalidate old responses. Cloud profiles no longer overwrite the offline practice save. Token failures do not silently join a room as an unidentified guest.
- A verified new account receives its anonymous guest save once. An existing meaningful account opens a decision screen showing name, KR and matches: use its save or return to the guest session. Existing progress is never merged or overwritten. An untouched starter row does not block transfer. Browser-only legacy practice balances are not trusted account funds.
- Account KR/challenges accrue from authoritative online matches. Practice remains available but does not mint account KR.
- Rewards use a persistent-volume outbox, independent backoff and quarantine of malformed files. Late guest rewards follow the migration destination; durable receipt keys prevent replay across the transfer. Read-only refreshes do not unnecessarily increment save revisions.

## Combat
- MICA: 1.45-second reload, full pellet damage through 8 m, 55% at 16 m, 10% at 24 m and zero at 30 m. Twelve pellets and close-range lethality retained.
- MICA aim is calibrated to the model's bead tip; idle ADS sway no longer moves the sight away from center.
- ECHO interval: 0.080 seconds (750 rounds/minute). KILO: 0.126 seconds (about 476 rounds/minute).
- Bots: Rivet, Vex, Knox, Dash, Jett, Crux, Sparks and Rally; scoreboard BOT identification retained.

## Required deployment steps
1. Back up the Supabase database. Run `supabase/002_account_integrity.sql` after the existing `001_accounts.sql`. A fresh project needs both, in order. The new migration preserves existing meaningful saves and adds atomic migration/replay safeguards.
2. Attach persistent storage to the room service and set `KRAGE_ACCOUNT_OUTBOX` to a writable directory on that volume, e.g. `/app/server/data/account-outbox`. Do not use `/tmp` or a container's disposable filesystem. An unmounted directory is not durable. Monitor deferred reward logs and `.invalid` files.
3. Keep existing Supabase URL, publishable key, server-only secret, Google redirect and SMTP/OTP settings. The secret must never have a NEXT_PUBLIC prefix. Frontend and server must refer to the same Supabase project.
4. Deploy both frontend and room server together: protocol 22, version 1.6.0. Use `npm ci`, `npm run build:render` for the frontend and `npm run build:server` for the rooms.
5. Verify Google and email-code login against the real provider, cross-device saves, guest transfer, existing-account cancellation, claims after refresh, reconnects and persistent-volume restart recovery. Local tests cannot certify the live provider configuration.

## Validation commands
`npm test`, `npm run test:server`, `npm run test:accounts`, `npm run lint`, `npx tsc --noEmit`, `npm run build:render`.
`tests/account-integrity.sql` exercises migration, preservation, duplicate receipts, revision conflicts and role permissions against a disposable PostgreSQL database after the migrations. It must never be run on production data.

## Verification result
160 automated tests passed (68 simulation, 49 presentation, 38 room-server, 5 account integration), plus real temporary PostgreSQL migration/permission checks. Browser checks against isolated mock auth verified persisted claims and names, existing-account choice/cancellation, and new-account guest transfer with no runtime exceptions. Lint and type checks passed. Live Google/SMTP/Supabase settings and real cross-device deployment still require the deployment checks above.

Dependency updates removed high/critical advisories in the checked lockfile. The final npm audit reports eight moderate upstream advisories; no forced downgrade or blanket override was applied. These remain a release limitation to monitor, not a claim of complete security certification.
