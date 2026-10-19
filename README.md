# A C-Drive Carol

> *Jacob Marlware was dead, to begin with. There is no doubt whatever about that. The record of his removal was signed by the antivirus, the Task Manager, the Registry, and Windows Update. Jacob Marlware was as dead as a floppy disk.*

**A C-Drive Carol** is a retelling of one of the greatest ghost stories ever written. It may be associated with another time of year, but the age-old tale of a miserly wretch, visited by three spirits in the night and driven against his will to tangibly change course, is a haunting through and through, and it fits right in.

In this telling, the miser is you, and the hoard is your hard drive.

Built for **Hackyard Yard #5 · Haunted**: *build something that creeps into something real, and actually works.*

---

## The night

A C-Drive Carol is a Windows desktop app. It looks through your Downloads, Desktop and Documents, and then your desktop is visited.

1. **The warning.** When the scan finishes, the ghost of Jacob Marlware appears in a corner of your screen, dragging a chain forged from your own biggest files. He warns you that three spirits are coming within the half hour. You choose: *I shall be here*, *Not tonight*, or *Bring them now*.
2. **The waiting.** A chain rattles somewhere far off. One of your old downloads drifts along the bottom of the screen and fades. The edges of the screen go cold. The spirits only ever arrive at a safe moment: never while something is fullscreen, never while your camera or microphone is in use.
3. **The visit.** A bell tolls. Your desktop dims, and the three spirits come in turn:
   - **The Ghost of Downloads Past** shows you your oldest forgotten files. Each one tells you who it was, and installers for apps you already have plead to be let go.
   - **The Ghost of Filesystems Present** lines up your duplicate files, identical to the last byte, and lets them argue over which of them is real.
   - **The Spirit of Disk Space Yet to Come** says nothing. It points at a gravestone that carves the month your drive will be full.
4. **The morning.** Everything you chose is laid to rest in the Crypt at once, and the gravestone cracks.

Press **Esc** at any moment and the haunting ends instantly, with nothing changed.

## The cast

| Spirit | Haunts | Speaks in |
| --- | --- | --- |
| Jacob Marlware | The warning, and your heaviest files | IM Fell English; his letters glitch before they settle |
| The Ghost of Downloads Past | Old downloads and leftover installers | Cormorant Garamond, light italic; words surface like memories |
| The Ghost of Filesystems Present | Duplicate files | Abril Fatface; loud, and shadowed by a copy of himself |
| The Spirit of Disk Space Yet to Come | Your drive's future | Never speaks. The gravestone does, in Cinzel |
| Your files | Themselves | JetBrains Mono. Spirits speak in serif; files speak in code |

Every line is written from what your files actually are: the site they came from, how long they've waited, the exact minute they arrived. *"You fetched me at 2:14 in the morning, on a Tuesday. Do you remember why you were awake?"*

## Harmless by design

Yard #5 asks entries to keep it harmless: opt-in, reversible, on your own stuff only, and nothing that deletes data, spreads, or touches anyone else's device. A C-Drive Carol is built around that.

- **Nothing is ever deleted.** "Lay to rest" moves a file into a single folder, the Crypt (`Documents\A C-Drive Carol\Crypt`). The app contains no code that deletes files. Burying them for good is something only you do, by emptying the Crypt yourself in File Explorer.
- **Everything is reversible.** The Crypt keeps a log of where every file came from. **Resurrect** puts one file, or all of them, back exactly where they were.
- **Opt-in at every step.** Nothing happens until you agree on first run. You choose when the spirits come. Nothing moves until you confirm the final review.
- **Your own stuff only.** It only looks inside your own Downloads, Desktop and Documents folders. Never system folders, other users, network drives or removable drives.
- **It doesn't spread.** Files are moved, never copied, and only within your own drive. The app has no network access at all, and it doesn't start with Windows unless you switch that on.
- **Nothing goes to the cloud.** Files in OneDrive-synced folders are never moved, and the Crypt is never placed inside OneDrive, so laying a file to rest can't upload it or remove it from your other devices.
- **Nothing leaves your computer.** There are no AI calls and no analytics. Every line the spirits say comes from a bank of written templates filled in locally.

## Demo mode: a haunting with nothing at stake

**Summon the spirits with sample files** creates a small folder of stand-in files: old installers, a 2 a.m. download, a "5.8 GB" disk image, duplicate reports and photos. Every file is about 1.5 KB; the whole set is under 40 KB. Their sizes, dates and history are simulated, recorded in a manifest, and labelled as simulated on screen.

Everything else runs for real: duplicates are genuinely identical files and are found by hashing, origins are read from real Windows download records, and laying to rest and resurrecting really move the sample files in and out of their own Crypt. Judges can see the whole night without touching a single file of their own.

## How it works

Every haunting runs on a **manifest**: a description of the files, the drive, and which files are duplicates. A real night builds one by scanning your folders; a demo night builds one from the sample set. Both have exactly the same shape, so the spirits never need to know which kind of night it is.

| File | What it does |
| --- | --- |
| [`core/scan.js`](core/scan.js) | Reads your folders and builds a real manifest. Read-only: it never moves, changes or sends anything. |
| [`core/make-sample.js`](core/make-sample.js) | Builds the demo folder and its manifest from [`core/sample-manifest.json`](core/sample-manifest.json). |
| [`core/manifest.js`](core/manifest.js) | Chooses who haunts: old files for the Past, duplicate groups for the Present, the forecast for the gravestone. Turns each file into its lines. |
| [`core/spirit-lines.js`](core/spirit-lines.js) | The bank of lines, with helpers that fill them from real file details and avoid repeats. |
| [`core/crypt.js`](core/crypt.js) | Lay to rest and Resurrect. Moves only, with a log; no deletion. |
| [`src/main/`](src/main) | The Electron app: tray, setup window, the overlay, the scheduler (when the spirits come), safe-moment checks, and the network lock. |
| [`src/renderer/overlay/`](src/renderer/overlay) | The haunting itself: the phosphor spirits (PixiJS), Marlware's physics chain, the gravestone, the dialogue and the five staves. |

**Finding duplicates.** Files are grouped by size first, since only files of the same size can match. Candidates then get a quick hash of their first 64 KB, and only files that still match get a full SHA-256. Files that live only in the cloud (OneDrive placeholders) are skipped, because reading them would force a download. Hard links to the same file aren't counted as duplicates.

**Installers.** On Windows, the scan reads each installer's embedded product name and version without running it, and compares them against the installed-programs list that *Apps & features* uses. That's how an installer knows whether its app is installed, newer, or was never installed at all.

**Where a file came from.** Windows records the site behind each download (the *Mark of the Web*, stored in the file's `Zone.Identifier`). The spirits use the site name only, never the full address.

**The gravestone.** The forecast divides your free space by how fast your folders have grown over the last six months. The second date shows the same forecast with tonight's Crypt buried.

**A safe moment.** Before an omen or a visit, the app asks Windows whether it's a good time to interrupt (the same check notifications use, which says no during fullscreen apps, games, presentations and quiet hours), reads the registry to see whether any app is using the camera or microphone right now, and waits until you've stopped typing for ten seconds.

**No network, enforced.** Every request from every window is cancelled unless it's one of the app's own files, and the app's browser engine is told that no host name exists. A test checks the source for any code that deletes files, copies them, or talks to the web.

## Run it

Windows 10 or 11, with [Node.js](https://nodejs.org) 22 or newer.

```sh
git clone https://github.com/afterimage-dev/a-c-drive-carol.git
cd a-c-drive-carol
npm install
npm start
```

The setup window explains what the app does and offers two ways in: **Haunt my computer** (a real, read-only scan of your Downloads, Desktop and Documents) or **Summon the spirits with sample files**. After that it lives in the tray: *Summon the spirits*, *Summon with sample files*, *Open the Crypt*, *Resurrect everything*, *Settings*, *Quit*. When Marlware warns you, choose **Bring them now** to skip the wait.

`npm test` runs the tests. `npm run dist` builds an installer and a portable `.exe` into `dist/` (unsigned, so Windows SmartScreen will ask before running it).

### Try the core on its own

The core needs only Node.js 18.15 or newer, and runs on any system. Windows gives the full picture; elsewhere the Windows-only details (installed apps, download origins, cloud-only files) are skipped.

```sh
# Build the demo night and hear what each spirit would say
node core/make-sample.js
node core/manifest.js "%USERPROFILE%\Documents\A C-Drive Carol\Sample\manifest.json"

# Scan your own folders (read-only) into a manifest
node core/scan.js my-manifest.json
node core/manifest.js my-manifest.json
```

## Credits

- **Charles Dickens**, *A Christmas Carol* (1843), which is in the public domain. Lines borrowed from it are used lovingly and sparingly.
- **Typefaces**, all under the SIL Open Font License: IM Fell English (Igino Marini), Cormorant Garamond, Abril Fatface, Cinzel, JetBrains Mono and Atkinson Hyperlegible.
- **Animation**: [PixiJS](https://pixijs.com) (MIT).
- **Character art**: generated with an AI image model, then cut out and animated in code.

## License

MIT
