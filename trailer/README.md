# Trailer

A 111-second horror-trailer demo video, made entirely in code from the project's own sprites, fonts and animation, with an original synthesised soundtrack (no samples, no licences needed).

| File | What |
| --- | --- |
| `timeline.json` | Every shot and sound cue, in seconds. The single source of timing for picture and sound. |
| `trailer.src.html` | The deterministic renderer (PixiJS 7.4.2 for the spirits, Canvas 2D for everything else) with placeholders. |
| `soundtrack.py` | Synthesises `soundtrack.wav` / `.mp3` from the timeline (room tone, braams, bell, slams, trailer pulse, riser, heartbeat, jump-scare stinger, carving grinds, music box lullaby, birdsong, chain clinks). Mixed to about -16.7 LUFS. |
| `build.py` | Builds `trailer_render.html` (for frame capture) or `trailer.html` (the player page with the soundtrack embedded). Reads sprites from `assets/sprites/`; needs `npm i @fontsource/{im-fell-english,cinzel,cormorant-garamond,abril-fatface,jetbrains-mono,ibm-plex-mono,atkinson-hyperlegible} pixi.js@7.4.2` in this folder. |
| `shoot.py` | Captures frames with Playwright and pipes them to ffmpeg (1920x1080, 30 fps, H.264). `python shoot.py preview 12.5,40` for stills, `python shoot.py video out.mp4` for the full render (~8 minutes in software GL). |

Rebuild: `python soundtrack.py && python build.py render && python shoot.py video video_silent.mp4`, then
`ffmpeg -i video_silent.mp4 -i soundtrack.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -movflags +faststart -shortest a-c-drive-carol-trailer.mp4`.

## Structure

0:00 found footage (NIGHT 1, 02:14) · 0:11 the eulogy (the Registry line holds) · 0:26 Marlware's warning, the bell · 0:38 THREE SPIRITS. · the Past, then an installer pleads; the cursor clicks Lay to rest and its ghost drifts into the Crypt ("1 soul at rest · 42 MB ready to bury") · 0:50 ONE NIGHT. · the Present · two duplicates argue, identical to the last byte; "This one is real" · "Impostors, begone!" · the impostor breaks and falls away ("1 impostor laid to rest") · 1:05 NO ESCAPE. (press Esc) · Yet to Come · strobe montage · 1:16 silence, 03:00, the second cursor, the jump · 1:23 the gravestone · 1:32 title, "A retelling of the greatest ghost story ever written." · 1:40 morning, "Git bless us, every one, and every zero." · 1:49 one chain link falls in the dark.

Each shot has an `orig` time in `timeline.json`: the time its animation was authored at, so shots can be moved and re-timed without rewriting their animation. Shots with `orig: null` animate on their own local time.

Swap in real screen recordings of the app as they exist: each shot is a `case` in `render()` keyed to `timeline.json`.
