// The setup window: first-run consent, settings, and the Crypt.
import { humanSize } from "../../../core/manifest.js";

const carol = window.carol;
const $ = (id) => document.getElementById(id);
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function render() {
  const info = await carol.get();
  document.querySelectorAll("[data-place]").forEach((e) => { e.textContent = info.places[e.dataset.place] || e.dataset.place; e.title = e.textContent; });
  document.querySelector(".cloud").hidden = !info.places.cloud;
  $("sound").checked = info.settings.sound;
  $("startWithWindows").checked = info.settings.startWithWindows;
  $("version").textContent = `Version ${info.version}`;
  renderCrypt(info.resting);
}

function renderCrypt(r) {
  $("crypt").hidden = r.count === 0;
  $("restingLine").textContent = `${r.count} ${r.count === 1 ? "file rests" : "files rest"} in the Crypt · ${humanSize(r.bytes)} ready to bury${r.simulated ? " (some sizes simulated)" : ""}`;
  $("restingList").innerHTML = r.entries.slice(-40).reverse().map((e) => `<li><span title="${escape(e.from)}">${escape(e.name)}${e.sample ? " · sample" : ""}</span><span>${humanSize(e.size)}</span><button type="button" data-key="${escape(e.key)}">Resurrect</button></li>`).join("");
}

$("sound").addEventListener("change", (e) => carol.save({ sound: e.target.checked }));
$("startWithWindows").addEventListener("change", (e) => carol.save({ startWithWindows: e.target.checked }));
$("openCrypt").addEventListener("click", () => carol.openCrypt());
$("resurrectAll").addEventListener("click", async () => { await carol.resurrect(null); renderCrypt(await carol.resting()); });
$("restingList").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-key]");
  if (!b) return;
  await carol.resurrect([b.dataset.key]);
  renderCrypt(await carol.resting());
});
document.querySelectorAll("#begin button").forEach((b) => b.addEventListener("click", async () => {
  document.querySelectorAll("#begin button").forEach((x) => (x.disabled = true));
  $("progress").textContent = b.dataset.mode === "sample" ? "Laying out the sample files…" : "Looking through your folders. This only reads; nothing is changed.";
  try { await carol.begin(b.dataset.mode); }
  finally { document.querySelectorAll("#begin button").forEach((x) => (x.disabled = false)); }
}));
carol.onProgress((text) => { $("progress").textContent = text; });
render();
