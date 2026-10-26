# WEBCAM ARCADE BGM levels

Supplied originals remain unchanged in the project-root `BGM/` folder. These
release copies were measured over the full songs with FFmpeg `loudnorm`
(integrated LUFS, loudness range and true peak), adjusted with linear two-pass
normalization, and measured again **after MP3 encoding**. No extra compression
or arrangement changes were applied. Target: −20 LUFS, true peak ceiling −2 dBTP.
Output: stereo 44.1 kHz / 192 kbps MP3.

| Song | Original LUFS | Original dBTP | Release LUFS | Release dBTP | Loudness change |
| --- | ---: | ---: | ---: | ---: | ---: |
| WebArcMainTitle | −13.32 | +0.18 | −20.26 | −6.87 | −6.94 dB |
| WebArcBounce | −14.83 | +0.35 | −20.26 | −4.82 | −5.43 dB |
| WebArcQS | −13.98 | −0.56 | −20.26 | −6.92 | −6.28 dB |
| WebArcLTR | −14.83 | +0.35 | −20.26 | −4.82 | −5.43 dB |

The original Bounce and LTR files have the same SHA-256 digest and contain the
same supplied audio. Their logical roles are kept separate for replacement;
Vite can share the identical release asset in a build. See `levels.json` for
source hashes and measured loudness ranges.

Runtime mix: existing master 0.65, default music volume 0.65. Relative track
gains are title 0.90, bounce 0.75, quick 0.70 and leisure 0.80. Approximate music
levels before shared output compression are respectively −28.7, −30.2, −30.8
and −29.7 LUFS at these defaults. These are calculated playback levels, not
additional file measurements, and listeners can adjust the music slider.

Routing: menus → title; shoot/RPS and their results → bounce; cham/dodge and
their results → quick; circle and its result → leisure. Music streams only
after a user gesture. Same-track navigation preserves position; track changes
crossfade over 700 ms. Mute, music off and hidden tabs pause music. The BGM
toggle and volume are stored separately from the shared sound mute.

Reproduce with `python scripts/normalize-bgm.py --ffmpeg /path/to/ffmpeg`.
