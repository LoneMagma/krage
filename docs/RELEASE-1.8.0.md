# KRAGE 1.8.0: audio identity and timing

Fire recordings and their gain/pitch behavior remain unchanged. Lobby music remains unchanged.

New ElevenLabs-generated victory, defeat, elimination, slide and menu cues replace their older counterparts. Existing reload, knife, movement, hit/headshot and reward sources are trimmed, filtered and normalized. Equip, jump, spawn and material impact samples are now wired instead of relying solely on oscillators. The 29 mono 32 kHz cues total 652 KB; decode happens once, with existing synth fallback on failed asset requests. The existing 48-voice ceiling and master limiter remain.

Reload opening plays once from the gameplay event. Magazine/shell and bolt/hinge contacts follow reload progress; cancellations reset their state. Skipped frames play only the latest relevant contact. Footsteps retain distance remainder and include remote humans, with distance, pan and crouch attenuation. Slide sample starts during the slide. Result cues stop on lobby/round transitions.

Sources: sound assets/v18/provenance.json records ElevenLabs generation IDs and prompts. scripts/prepare-v18-audio.mjs rebuilds public/audio/v18 from generated and original sources. Its manifest records durations, hashes and preserved firearm hashes. No ElevenLabs connection, API key or network generation is needed at runtime. Three extra click variations were rate-limited; one completed take was used, without retry charges.

Validation: core/presentation tests, asset decoding/hash/size checks, lint, TypeScript and production build. Audition on actual speakers/headphones remains a subjective player check; these checks do not certify sound taste or live-device mixing.

## Final revision
Restored the older tactile menu click. Replaced abrasive slide recording with a reproducible, filtered 170 ms air wave and moved playback to slide entry. Elimination sound now runs on the points UI commit; removed delayed/staggered point entrance. MICA first-person geometry is scaled to 72%, including hands, with compensated sight height; world/locker scale and gameplay aim are unchanged. Final cue payload: 638 KB. Re-ran 120 tests, lint, type checks and production build.
MICA follow-up: slender first-person forearms now continue below the viewport instead of ending as floating blocks. A rendered ADS preview was inspected; sight-alignment regressions, 120 tests, lint and types pass.
