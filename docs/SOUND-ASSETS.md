# v0.7 revised audio

Runtime gunfire uses the four original files in `public/audio/weapons` (two ECHO variations, KILO and MICA). The generated v07 gunshots are no longer loaded.

`python scripts/prepare-revised-audio.py` reproduces the latest reloads from preserved recordings in `sound assets/v07-revised`, the first 1.0 second of the supplied EDGE air recording, and a deterministic soft 0.32-second slide swoosh. The double-barrel attachment is used for MICA reload; its fire remains the old recording. Footstep gain was reduced from .45 to .39. Other EDGE sounds remain unchanged.

Run `scripts/prepare-sound-pack.py` before the revised script only when rebuilding the entire original effects pack. Runtime voices remain bounded and use the master volume. Format, nonzero audio and safe peaks are checked; subjective mix quality needs listening during play. The defeat source retains its original baked-in distortion as previously requested.
