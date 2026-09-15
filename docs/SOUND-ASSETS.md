# v0.7 sound pack

16 supplied WAV recordings are preserved in `sound assets`. Run `python scripts/prepare-sound-pack.py` to reproduce the 30 mono 44.1kHz runtime clips and manifest in `public/audio/v07` (about 1.27 MiB).

Connected: distinct ECHO/KILO/MICA fire and three-stage reload recordings; EDGE slash, stab and contact; hit, headshot and kill; footsteps, landing and slide; victory, defeat, click and reward. Full reload references are retained alongside the event-aligned phase clips. Fire, reload and result events use a recording or their procedural fallback, never both. Master volume and the 48-voice cap apply. Lobby music remains separately controlled at its existing default level.

Preparation removes silence and DC offset, filters rumble/harsh highs, limits gain and fades clip boundaries. Integrity checks cover format, nonzero samples, safe peaks and faded edges. No required sound slot remains missing; hit/click/landing and footsteps use edited excerpts from the supplied recordings.

The current defeat sound is retained at the user's request, filtered and played more quietly. Its original baked-in clipping cannot be recovered by lowering gain. Final subjective mix evaluation still benefits from listening during real matches.
