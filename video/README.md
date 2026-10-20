# The demo video

About 1:45 of the app itself, recorded in OBS on a real desktop with the sample files, cut together by a script. Short cards between the staves say what each one really does; captions over the last shots show that nothing is deleted and Esc ends it all.

| File | What |
| --- | --- |
| `record.ps1` | Starts one take: the sample night with a fresh profile and YOUR C: on the gravestone (`--anonymous`). |
| `cut.json` | The edit: the cards' words, and each clip's take, in and out. |
| `build.js` | Builds the video from `cut.json` and the takes, with ffmpeg. |
| `render-cards.js`, `cards.html` | Draws the cards in the app's own type (Electron, offscreen). |
| `takes/` | The OBS recordings. Not committed. |
| `out/` | What `build.js` makes. Not committed. |

## Recording

### OBS, once

- **Settings → Output → Recording:** path `…\a-c-drive-carol\video\takes`, format **MKV** (a crash doesn't lose the take), encoder **NVIDIA NVENC H.264**, rate control **CQP 16**.
- **Settings → Video:** base and output resolution **1920×1080**, **60** fps.
- **Settings → Audio:** Desktop Audio on; **Mic/Aux off**.
- **Scene:** one **Display Capture** of the main display, with the cursor shown.
- **Settings → Hotkeys:** a key for Start/Stop Recording (say Ctrl+F9), so OBS can stay minimised.

### The desktop, before each session

The bell photographs your desktop, and the whole visit is drawn over that picture, so the desktop is the set.

- An ordinary wallpaper, a handful of believable icons, nothing personal.
- Close mail and chat. Check the taskbar for anything you don't want shown.
- Turn on **Do not disturb**, so no notifications land in the shot. It doesn't hold the spirits back: *Bring them now* doesn't wait for a safe moment.
- System volume at a normal level, nothing else playing.
- Move the mouse slowly and deliberately. Viewers follow the cursor.

### A take

1. `powershell -ExecutionPolicy Bypass -File video\record.ps1`
2. During the countdown: start recording, then minimise the terminal.
3. Play the night (below). Don't press Skip intro.
4. Stop recording after the Explorer shot, then **Quit** from the tray.
5. Rename the take in `video\takes` (`night1.mkv`, `night2.mkv`, …).

Every take starts from a fresh profile (in `.scratch\video\`), so files kept or banished in one take still appear in the next. Every sample night also returns anything left in the sample Crypt first, so the Crypt starts empty.

### The night, beat by beat

A full night takes about 7 minutes raw. Let every line finish before clicking on; the cut can always take time out, but can't put it back.

| Stave | Do |
| --- | --- |
| Opening | Nothing. Let the title page and the eulogy play. |
| One · Marlware | When he's in and talking, take a link of the chain near his hand, drag it slowly, and let go. Once is enough. When he asks, choose **Bring them now**. |
| The bell | Hands off. |
| Two · the Past | Click **Long past?** Rest the cursor on `invoice_march (3).pdf` (the 2:14 a.m. one) to stop the orbit, then click it; let its card play; **Lay to rest**. Then an installer that pleads (`SteamSetup.exe` or `vlc-3.0.20-win64.exe`); **Lay to rest**. One more file, **Keep**. Then **Enough, spirit**. |
| Three · the Present | Let each group argue before choosing. First group: **This one is real** on the highlighted one ("Impostors, begone!"). Second: another **This one is real**. Third: **Keep them all**. |
| Four · Yet to Come | Bring the candle (the cursor) slowly in from the right until he's lit; hold it on him. Look away and he comes closer. When the stone rises on the right, move the light slowly over it to melt the frost: name, cause, then the date. Wait while the date is struck out and carved later, then click your vow. |
| Five · morning | Let the narration play. Leave everything ticked in the review and click **Wake up**. Let "Git bless us…" finish, then **Open the Crypt**. |
| Proof | Explorer opens on the Crypt with tonight's files. Hold 2 s. Tray → **Resurrect everything**. Press Alt+Up to go up to the Sample folder, where the files are back. Hold 2 s. Stop recording. |

### The Esc take

`powershell -ExecutionPolicy Bypass -File video\record.ps1 -Scene present`: let the first group argue, choose **This one is real**, then press **Esc** partway through the next line. Hold 3 s on the plain desktop. Name it `esc1.mkv`.

### What to get

Two or three full nights and one or two Esc takes. Check the first take's Explorer shot: if the address bar shows your account name, we'll crop or blur it in the cut.

## Cutting

Fill in `cut.json`: for each clip, its `take` and its `in` and `out` (seconds, or `m:ss.s`, from the start of the take). The notes say what each clip should hold, and the targets add up to about 1:45. Then, on Windows:

```sh
node video/build.js --cards    # the cards on their own (out/cards-reel.mp4)
node video/build.js --draft    # a quick cut for review (out/draft.mp4)
node video/build.js            # the final video (out/a-c-drive-carol-demo.mp4), 1080p60, sound at -14 LUFS
```

`build.js` prints where each segment starts in the video, so review notes can refer to times. It needs ffmpeg and ffprobe on the PATH.
