# Recorded weapon audio

The supplied MP3s are the source for four small mono PCM WAV assets (103,196 bytes total). ECHO alternates two 64 ms shots cut from the SMG burst; KILO uses a 340 ms single-shot cut; MICA retains a 700 ms blast. Attack padding and noisy tails are removed. High/low-pass filtering, modest low-frequency EQ, short edge fades and -2 dBFS peak normalization preserve the original attack.

Rebuild with `python3 scripts/prepare-weapon-audio.py /path/to/source/folder` (ffmpeg required). `public/audio/weapons/manifest.json` records original filenames and cut times. Original files are user-provided; no additional source license is asserted by this repository.

Audio decodes once after the first interaction, outside the shot loop. Each actual or locally predicted firing event starts one source. Small playback-rate/gain variations avoid identical repetition; remote shots pan and lose high frequencies with distance. Master volume, effect mute and voice limits also apply. Failed downloads retain the synthesized fallback. Reloads, footsteps and result cues remain synthesized pending additional recordings.

Automated checks verify source count, positional filtering, voice cleanup and fallback selection. They do not establish subjective mix quality: audition during sustained fire on headphones and laptop speakers before final release.
