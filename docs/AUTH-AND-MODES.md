# Accounts and Capture the Flag

## Accounts: next foundation, not a cosmetic login button
Use Supabase Auth with Google OAuth and email/password with required email verification and password reset. An email OTP is also viable if avoiding passwords. Keep guest play available; offer account upgrade to preserve progress. OAuth client, allowed redirect URLs, Supabase project and production SMTP must be configured before live integration.

- Identity: stable auth user UUID. Room service verifies access tokens (issuer, audience, signature, expiry), never a client-supplied user ID. Refresh/reconnect retains the player ID. Do not expose email to room peers.
- Durable profile: display name, equipped character/finishes and preferences keyed by user ID. Fetch on login/reconnect, debounce field-level preference patches, use revision checks to avoid an old device overwriting a newer update. Keep device-specific graphics settings local by default.
- Protected data: inventory, earned KR, purchase ledger, daily/weekly claims and match receipts live in a durable database. Row-level security isolates accounts; only trusted server transactions award/spend KR. Unique event IDs prevent duplicate match rewards or purchases.
- Existing practice saves are untrusted. Import non-sensitive preferences; define a limited cosmetic migration policy. Never copy arbitrary local KR into a verified account balance.
- Tests: unverified email rejected; Google/email linking preserves identity; sign-out/account switching clears previous data; expired tokens refresh/reject correctly; two devices sync; parallel purchases/duplicate receipts cannot mint KR. Include account recovery/deletion and backup restore.

Official setup: https://supabase.com/docs/guides/auth/social-login/auth-google and https://supabase.com/docs/guides/auth/passwords

## Capture the Flag: the next mode
A 3v3 objective match fits the movement/combat loop by creating runners, escorts and defenders without adding weapons. Start with custom rooms on a specifically adapted Snow layout; do not split the small public queue yet. Keep existing FFA, team deathmatch and duels.

- Two clearly colored bases, two flags; first to three captures or seven-minute score wins. Ties draw in the first prototype.
- Steal the enemy flag and bring it home while your own flag is home. Death/disconnect drops it; a teammate touches their dropped flag to return it. Unclaimed flags return after 25 seconds. A carrier keeps their normal weapons and speed.
- HUD: two flag-state icons, capture score, time and a readable carrier marker. Audio/cues distinguish pickup, drop, return and capture. Reward captures/returns through objectives, not farmable repeated pickup KR.
- Server owns flag states (home/carried/dropped), pickup range, captures and resets. Reconnect cannot duplicate flags. Bots receive simple carrier/escort/defend roles rather than chasing arbitrary kills.
- Maps need protected base spawns with two exits, at least two viable flag routes and a contested central shortcut. Current FFA spawn selection cannot simply be reused for CTF. Begin with Snow; validate travel times, sightlines and camping before adapting Dune. Cells remain duel/team deathmatch maps.
- Acceptance: equal route opportunity for both teams, no flag clipping, safe respawns, carrier death/reconnect handling, clear match end and bot objective participation. This mode is a proposal, not implemented in this ZIP.
