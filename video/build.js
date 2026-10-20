// The demo video, cut from the OBS takes by cut.json (see README.md). The cards are drawn in the app's own type by
// render-cards.js; every segment is trimmed, faded and encoded alike, so the parts join without re-encoding; then the
// sound is levelled for YouTube (-14 LUFS). Needs ffmpeg and ffprobe on the PATH. Run on Windows:
//   node video/build.js            the video, into video/out
//   node video/build.js --draft    a quicker, rougher encode, for reviewing a cut
//   node video/build.js --cards    only the cards, one after another (out/cards-reel.mp4), before there are takes
// CUT=path uses another cut file (for trying the pipeline out). Outputs are overwritten in place; nothing is deleted.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import electron from "electron";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const cut = JSON.parse(fs.readFileSync(process.env.CUT || path.join(HERE, "cut.json"), "utf8"));
const flags = new Set(process.argv.slice(2));
const CARDS_ONLY = flags.has("--cards"), DRAFT = flags.has("--draft");
const [W, H] = cut.size, FPS = cut.fps;
const TAKES = path.join(HERE, "takes"), OUT = path.join(HERE, "out"), PARTS = path.join(OUT, "parts");
const FFMPEG = process.env.FFMPEG || "ffmpeg", FFPROBE = process.env.FFPROBE || "ffprobe";
const QUIET = ["-hide_banner", "-loglevel", "error", "-y"];
const LOUDNESS = "I=-14:TP=-1:LRA=11";

// Every part encoded the same way, so they can be joined as they are. Sound stays uncompressed until the end.
const ENCODE = [
  "-c:v", "libx264", ...(DRAFT ? ["-preset", "veryfast", "-crf", "24"] : ["-preset", "slow", "-crf", "16"]),
  "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2"
];
const FIT = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p`;

/** Seconds, from 12.5, "1:02.5" or "0:01:02.5". */
function seconds(t) {
  if (typeof t === "number") return t;
  return String(t).split(":").reduce((s, part) => s * 60 + Number(part), 0);
}

const clock = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

function run(cmd, args, { capture = false } = {}) {
  const r = spawnSync(cmd, args.map(String), { stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit", encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} stopped (${r.status})${capture ? `\n${r.stderr.slice(-2000)}` : ""}`);
  return r;
}

const hasSound = (file) => run(FFPROBE, ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file], { capture: true }).stdout.trim() !== "";

/** Fades in and out of black (fade) or silence (afade), as a filter chain to append. */
function fades(filter, dur, fadeIn = 0, fadeOut = 0) {
  const out = [];
  if (fadeIn > 0) out.push(`${filter}=t=in:st=0:d=${fadeIn}`);
  if (fadeOut > 0) out.push(`${filter}=t=out:st=${(dur - fadeOut).toFixed(3)}:d=${fadeOut}`);
  return out.length ? `,${out.join(",")}` : "";
}

const cardPicture = (id) => {
  if (!cut.cards[id]) throw new Error(`There's no card called "${id}" in cut.json`);
  return path.join(OUT, "cards", `${id}.png`);
};

/** One segment, encoded into out/parts. Returns its file and length. */
function part(seg, i) {
  const file = path.join(PARTS, `${String(i).padStart(2, "0")}-${seg.id || seg.card}.mkv`);
  const inputs = [], filters = [];
  let dur, video, sound = null;
  const input = (...args) => { inputs.push(...args); return inputs.filter((a) => a === "-i").length - 1; };

  if (seg.card) {   // a whole-screen card, silent
    dur = seg.duration ?? 3;
    video = input("-loop", 1, "-framerate", FPS, "-t", dur, "-i", cardPicture(seg.card));
    filters.push(`[${video}:v]${FIT}${fades("fade", dur, seg.fadeIn ?? 0.4, seg.fadeOut ?? 0.4)}[v]`);
  } else {          // a clip from a take, or a plain colour (the reel's backing for captions)
    const fadeIn = seg.fadeIn ?? 0, fadeOut = seg.fadeOut ?? 0;
    if (seg.color) {
      dur = seg.duration;
      video = input("-f", "lavfi", "-t", dur, "-i", `color=c=${seg.color}:s=${W}x${H}:r=${FPS}`);
    } else {
      const src = path.resolve(TAKES, seg.take);
      dur = seconds(seg.out) - seconds(seg.in);
      video = input("-ss", seconds(seg.in), "-t", dur, "-i", src);
      if (hasSound(src)) sound = video;
    }
    filters.push(`[${video}:v]${FIT}[v0]`);
    let last = "[v0]";
    if (seg.caption) {   // the caption fades in and out on its own, then the clip's fades take both
      const from = seg.captionAt ?? 0.3, until = seg.captionUntil ?? dur - 0.3;
      const cap = input("-loop", 1, "-framerate", FPS, "-t", dur, "-i", cardPicture(seg.caption));
      filters.push(`[${cap}:v]scale=${W}:${H},format=rgba,fade=t=in:st=${from}:d=0.5:alpha=1,fade=t=out:st=${(until - 0.5).toFixed(3)}:d=0.5:alpha=1[c]`);
      filters.push("[v0][c]overlay=0:0:shortest=1[v1]");
      last = "[v1]";
    }
    filters.push(`${last}format=yuv420p${fades("fade", dur, fadeIn, fadeOut)}[v]`);
    if (sound !== null) filters.push(`[${sound}:a]aresample=48000,aformat=channel_layouts=stereo${fades("afade", dur, fadeIn, fadeOut)}[a]`);
  }
  if (sound === null) {
    const silence = input("-f", "lavfi", "-t", dur, "-i", "anullsrc=r=48000:cl=stereo");
    filters.push(`[${silence}:a]anull[a]`);
  }
  run(FFMPEG, [...QUIET, ...inputs, "-filter_complex", filters.join(";"), "-map", "[v]", "-map", "[a]", ...ENCODE, "-t", dur, file]);
  return { file, dur, label: seg.id || `card: ${seg.card}` };
}

/** Joins the parts as they are, then levels the sound in two passes (measure, then correct) and compresses it. */
function finish(parts, name) {
  const list = path.join(OUT, "parts.txt"), joined = path.join(OUT, "joined.mkv"), final = path.join(OUT, name);
  fs.writeFileSync(list, parts.map((p) => `file '${p.file.replace(/\\/g, "/")}'`).join("\n") + "\n");
  run(FFMPEG, [...QUIET, "-f", "concat", "-safe", 0, "-i", list, "-c", "copy", joined]);
  const measured = run(FFMPEG, ["-hide_banner", "-nostats", "-i", joined, "-vn", "-af", `loudnorm=${LOUDNESS}:print_format=json`, "-f", "null", "-"], { capture: true }).stderr;
  const m = JSON.parse(measured.slice(measured.lastIndexOf("{"), measured.lastIndexOf("}") + 1));
  const level = Number.isFinite(Number(m.input_i))   // all silence (the cards reel) has nothing to level
    ? `loudnorm=${LOUDNESS}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`
    : "anull";
  run(FFMPEG, [...QUIET, "-i", joined, "-map", "0:v", "-map", "0:a", "-c:v", "copy", "-af", level, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final]);
  return final;
}

/** What's missing before the cut can be built: clips without a take or times, takes not in video/takes. */
function problems(segments) {
  const out = [];
  segments.forEach((seg, i) => {
    if (seg.card) { if (!cut.cards[seg.card]) out.push(`segment ${i + 1}: no card called "${seg.card}"`); return; }
    const name = seg.id || `segment ${i + 1}`;
    if (!seg.take || seg.in == null || seg.out == null) { out.push(`${name}: needs a take, an in and an out`); return; }
    if (!fs.existsSync(path.resolve(TAKES, seg.take))) out.push(`${name}: video/takes/${seg.take} isn't there`);
    if (!(seconds(seg.out) > seconds(seg.in))) out.push(`${name}: its out (${seg.out}) isn't after its in (${seg.in})`);
  });
  return out;
}

const segments = CARDS_ONLY
  ? Object.entries(cut.cards).map(([id, c]) => (c.kind === "caption" ? { id: `caption-${id}`, color: "0x2b2a35", duration: 3.6, caption: id } : { card: id, duration: c.kind === "end" ? 5 : 3.2 }))
  : cut.segments;

const missing = CARDS_ONLY ? [] : problems(segments);
if (missing.length) {
  console.error(`The cut isn't ready:\n  ${missing.join("\n  ")}\nUse --cards to see the cards on their own.`);
  process.exit(1);
}

fs.mkdirSync(PARTS, { recursive: true });
console.log("Drawing the cards…");
run(electron, [path.join(HERE, "render-cards.js")]);

const parts = [];
let at = 0;
for (const [i, seg] of segments.entries()) {
  const p = part(seg, i);
  console.log(`${clock(at).padStart(6)}  ${p.label} (${p.dur.toFixed(1)} s)`);
  parts.push(p);
  at += p.dur;
}
const final = finish(parts, CARDS_ONLY ? "cards-reel.mp4" : DRAFT ? "draft.mp4" : cut.output);
console.log(`${clock(at).padStart(6)}  end\n${final}`);
