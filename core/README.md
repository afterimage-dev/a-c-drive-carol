# core · the spirits' brain

Plain Node.js ES modules (Node ≥ 18.15), no dependencies. Read-only scanning, the manifest, the line bank and the Crypt. Tested on Linux; the Windows-only parts need testing on Windows (see `docs/11-open-questions.md`).

| Module | Exports | Notes |
| --- | --- | --- |
| `manifest.js` | Types (`Manifest`, `HauntFile`, `Installer` as JSDoc), `pastCandidates(m, {minAgeDays=30, limit=16})`, `presentGroups(m)`, `suggestOriginal(files)`, `claimFor(f, files)`, `facts(f, m)`, `poolFor(f, m)`, `linesFor(f, m)`, `epitaphFor(f, m)`, `claimLine(f, files, m)`, `forecast(m, buryBytes)`, `compareVersions`, `humanSize`, `byId` | `node manifest.js <manifest.json>` prints what every spirit would say. |
| `scan.js` | `scan({ roots, crypt, onProgress })`, `defaultRoots()`, `defaultCrypt()` | Read-only. Walks Downloads (depth 2), Desktop (1), Documents (3), skipping hidden, system-ish and the app's own folder; duplicates by size → 64 KB hash → full SHA-256, skipping hard links and cloud-only files; installers vs installed apps; origins; last-access reliability; drive space and growth. `node scan.js out.json`. |
| `make-sample.js` | `makeSample(root)`, `defaultSampleRoot()` | Demo set from `sample-manifest.json`. Never deletes; reuses only a folder with its `.carol-sample` marker. `node make-sample.js [folder]`. |
| `crypt.js` | `layToRest(m, ids)`, `resurrect(crypt, ids?)`, `resting(crypt)` | Moves only, logged in `crypt-log.json`; refuses paths outside the manifest's roots; skips cross-drive moves; never overwrites. |
| `spirit-lines.js` | `LINES`, `pick(pool, data)`, `fill`, `ageWords`, `timeWords`, `timeOfDayPool`, `dateWords` | 145+ template lines in pools (general, neverOpened, large, timeOfDay.*, site.*, byType.*, installer.*, returning, reactions, doppelganger claims, epitaphs, Marlware, crypt, empty states). `pick` skips lines with missing facts and avoids recent repeats. |

## The manifest

```jsonc
{
  "version": 1,
  "mode": "real" | "sample",
  "createdAt": "ISO",
  "roots": { "Downloads": "...", "Desktop": "...", "Documents": "..." },
  "crypt": "...\\A C-Drive Carol\\Crypt",
  "accessTimesReliable": true,
  "drive": { "total": 0, "free": 0, "growthPerMonth": 0, "simulated": false },
  "files": [{
    "id": "f12", "path": "C:\\Users\\me\\Downloads\\vlc-3.0.20-win64.exe", "name": "vlc-3.0.20-win64.exe",
    "folder": "Downloads", "kind": "installer", "size": 44040192,
    "downloadedAt": "ISO", "lastOpenedAt": "ISO" | null,
    "origin": { "site": "videolan.org", "url": "https://..." } | null,
    "hash": "sha256" | null, "group": "g1" | null,
    "installer": { "product": "VLC media player", "version": "3.0.20", "installed": { "version": "3.0.21", "installDate": "ISO" } | null } | null,
    "timesBanished": 0,
    "simulated": []            // e.g. ["size", "downloadedAt", "lastOpenedAt", "installer"] in sample mode
  }],
  "groups": [{ "id": "g1", "hash": "sha256", "members": ["f3", "f9"] }]
}
```

## Which line a file speaks (Stave Two), first match wins

installer (`notInstalled` / `sameVersion` / `olderVersion`) → returning (banished before) → late night (00:00–05:00) → large (> 1 GB) → never opened (only if access times are reliable or simulated) → site unknown / frequent (≥ 3 files) / rare (50%) → by type (60%) → general. A second line about the time of day is added 40% of the time when that fact wasn't used.

## Quick check

```sh
node make-sample.js /tmp/carol/Sample
node manifest.js /tmp/carol/Sample/manifest.json
```
