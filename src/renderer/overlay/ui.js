// The overlay's DOM pieces: title cards, the dock, file cards, the Present's row of copies and the morning review.

import { el, esc, wait, until, tween } from "./util.js";
import { humanSize } from "../../../core/manifest.js";

export { humanSize };

const sim = (f, field) => (f.simulated || []).includes(field);
export const sizeText = (f) => `${humanSize(f.size)}${sim(f, "size") ? ' <span class="sim">(simulated)</span>' : ""}`;

/** A preview of what the file really is (pictures, videos, PDFs), when Windows could make one. */
export const previewHtml = (ctx, f) => (ctx.thumbs?.[f.id] ? `<img class="preview" src="${ctx.thumbs[f.id]}" alt="Preview of ${esc(f.name)}">` : "");

export function iconHtml(ctx, f) {
  const src = ctx.icons[f.id];
  return src ? `<img src="${src}" alt="">` : `<span class="noicon">${esc((f.ext || "file").slice(0, 4))}</span>`;
}

/** A stave's title card, in the book's own words. */
export async function title(ctx, stave, name, { hold = 2200 } = {}) {
  const card = el("div", "title-card", `<span class="stave">${esc(stave)}</span><span class="name">${esc(name)}</span>`);
  ctx.ui.appendChild(card);
  requestAnimationFrame(() => card.classList.add("on"));
  try {
    await wait(800 + hold, ctx.signal);
    card.classList.remove("on");
    await wait(800, ctx.signal);
  } finally {
    card.remove();
  }
}

/** A small bar at the bottom with a hint and buttons ("Enough, spirit"). `choice()` resolves with a button's key. */
export function dock(ctx, text, buttons = [], { accent } = {}) {
  const d = el("div", "dock interactive", `<span>${esc(text)}</span>`);
  if (accent) d.style.setProperty("--accent", accent);
  for (const [key, label, primary] of buttons) {
    const b = el("button", primary ? "primary" : "", esc(label)); b.type = "button"; b.dataset.key = key; d.appendChild(b);
  }
  d.style.top = `${Math.round((ctx.floorY ?? ctx.stage.H) - 58)}px`;
  ctx.ui.appendChild(d);
  requestAnimationFrame(() => d.classList.add("on"));
  let resolveChoice;
  const chosen = new Promise((r) => (resolveChoice = r));
  d.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { e.stopPropagation(); ctx.sound.clink(0.3); resolveChoice(b.dataset.key); } });
  return {
    el: d,
    choice: () => chosen,
    text: (t) => { d.querySelector("span").textContent = t; },
    hide: () => { d.classList.remove("on"); setTimeout(() => d.remove(), 450); }
  };
}

/** Type lines into an element in monospace, fast: files speak in code. */
async function typeLines(ctx, host, lines, cps = 46) {
  host.innerHTML = "";
  for (const line of lines) {
    const p = el("p"); host.appendChild(p);
    const start = performance.now();
    await until((done) => {
      const frame = (now) => {
        if (ctx.signal.aborted) return;
        const n = ctx.skipTyping ? line.length : Math.floor(((now - start) / 1000) * cps);
        p.textContent = line.slice(0, n);
        if (n >= line.length) done(); else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }, ctx.signal);
  }
}

/**
 * A file's card for the Ghost of Downloads Past: who it is, then what it says, then Lay to rest / Banish / Keep.
 * Resolves with "rest" | "banish" | "keep".
 */
export async function fileCard(ctx, f, { auto = null } = {}) {
  const meta = [sizeText(f), `arrived ${esc(f.arrived)}${sim(f, "downloadedAt") ? ' <span class="sim">(simulated)</span>' : ""}`,
    f.site ? `from ${esc(f.site)}` : "origin unknown", esc(f.folder)].join(" · ");
  const card = el("div", "file interactive", `
    <header>${iconHtml(ctx, f)}<div><div class="name">${esc(f.name)}</div><div class="meta">${meta}</div></div></header>
    ${previewHtml(ctx, f)}
    ${f.installer ? `<div class="note">${esc(f.installer)}${sim(f, "installer") ? " (simulated)" : ""}</div>` : ""}
    <div class="says"></div>
    <div class="choices"></div>`);
  card.style.left = `calc(50% - min(280px, 45vw))`;
  card.style.bottom = `${Math.round(ctx.stage.H - (ctx.floorY ?? ctx.stage.H) + 30)}px`;   // grows upwards, whatever it holds
  ctx.ui.appendChild(card);
  requestAnimationFrame(() => card.classList.add("on"));
  try {
    await typeLines(ctx, card.querySelector(".says"), f.lines);
    const row = card.querySelector(".choices");
    for (const [key, label, primary] of [["rest", "Lay to rest", true], ["banish", "Banish"], ["keep", "Keep"]]) {
      const b = el("button", primary ? "primary" : "", label); b.type = "button"; b.dataset.key = key; row.appendChild(b);
    }
    card.style.setProperty("--accent", "#ffb347");
    const choice = await until((resolve) => {
      row.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { e.stopPropagation(); ctx.sound.clink(0.3); resolve(b.dataset.key); } });
      if (auto) setTimeout(() => resolve(auto), 1800);
    }, ctx.signal);
    card.classList.add("gone");
    await wait(500, ctx.signal);
    return choice;
  } finally {
    setTimeout(() => card.remove(), 700);
  }
}

/**
 * The Present's row of identical copies, each arguing its claim. `choice()` resolves with a file id ("this one is
 * real") or "all" ("keep them all"); `fall(id)` sends every other copy tumbling.
 */
export function presentRow(ctx, group) {
  const row = el("div", "row interactive waiting");   // the buttons appear only once you can use them
  row.style.bottom = `${Math.round(ctx.stage.H - (ctx.floorY ?? ctx.stage.H) + 74)}px`;   // just above the dock, growing upwards
  const shown = group.files.slice(0, 4);
  const extra = group.files.length - shown.length;
  const cards = shown.map((f) => {
    const c = el("div", `copy${f.id === group.original ? " suggested" : ""}`, `
      <header>${iconHtml(ctx, f)}<div><div class="name">${esc(f.name)}</div><div class="meta">${esc(f.folder)} · ${esc(f.date)}${sim(f, "downloadedAt") ? " (simulated)" : ""}</div></div></header>
      ${previewHtml(ctx, f)}
      <div class="claim"></div>
      ${f.cloudSynced ? '<div class="stays">Lives in OneDrive, so it stays where it is.</div>' : ""}
      <button type="button" data-key="${esc(f.id)}"${f.id === group.original ? ' class="primary"' : ""}>This one is real</button>`);
    c.style.setProperty("--accent", "#9dff9f");
    c.style.setProperty("--tilt", `${(Math.random() - 0.5) * 16}deg`);
    c.dataset.id = f.id;
    row.appendChild(c);
    return c;
  });
  const foot = el("div", "copy on", `<div class="meta">${extra > 0 ? `and ${extra} more, identical to the last byte` : "identical to the last byte"}</div>
    <div class="meta">${humanSize(group.size)} each${sim(group.files[0], "size") ? " (simulated)" : ""}</div><button type="button" data-key="all">Keep them all</button>`);
  foot.style.width = "190px";
  foot.style.setProperty("--accent", "#9dff9f");
  row.appendChild(foot);
  ctx.ui.appendChild(row);
  let resolveChoice;
  const chosen = new Promise((r) => (resolveChoice = r));
  row.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { e.stopPropagation(); ctx.sound.clink(0.3); resolveChoice(b.dataset.key); } });
  return {
    async argue() {
      for (let i = 0; i < cards.length; i++) {
        cards[i].classList.add("on");
        await wait(250, ctx.signal);
        await typeLines(ctx, cards[i].querySelector(".claim"), [shown[i].claim], 52);
        await wait(500, ctx.signal);
      }
    },
    choice: () => chosen,
    /** Show the buttons: the copies have argued and the spirit has finished. */
    offer: () => row.classList.remove("waiting"),
    choose: (key) => resolveChoice(key),
    fall(realId) {
      cards.forEach((c) => c.classList.add(c.dataset.id === realId ? "real" : "impostor"));
      foot.classList.add("impostor");
    },
    async remove() { row.style.transition = "opacity .5s"; row.style.opacity = "0"; await wait(500, ctx.signal).catch(() => {}); row.remove(); }
  };
}

/**
 * Stave Five's review: tonight's choices, each untickable. Resolves with the ticked decisions on Wake up.
 * `result(r)` then shows what happened.
 */
export function review(ctx, groups) {
  const sections = [
    { key: "rest", title: "Laid to rest", note: "Moved into the Crypt" },
    { key: "impostors", title: "Impostors", note: "Moved into the Crypt" },
    { key: "banish", title: "Banished", note: `They return on ${ctx.returnDate}` },
    { key: "keep", title: "Kept", note: "Never asked about again" }
  ].filter((s) => groups[s.key].length);
  const total = (list) => list.reduce((s, f) => s + f.size, 0);
  const panel = el("div", "review interactive");
  const any = sections.length > 0;
  panel.innerHTML = `
    <h2>Tonight's choices</h2>
    <p class="lede">${any ? "Nothing has moved yet. Untick anything you've thought better of." : "Nothing was chosen tonight, so nothing will move."}</p>
    ${sections.map((s) => `
      <details${groups[s.key].length <= 6 ? " open" : ""} data-key="${s.key}">
        <summary><span>${s.title}</span><span class="n">${groups[s.key].length} · ${s.key === "rest" || s.key === "impostors" ? humanSize(total(groups[s.key])) + (groups[s.key].some((f) => sim(f, "size")) ? " (simulated)" : "") + " · " : ""}${esc(s.note)}</span></summary>
        <ul>${groups[s.key].map((f) => `<li><label><input type="checkbox" checked data-id="${esc(f.id)}"><span>${esc(f.name)}</span><span class="sz">${humanSize(f.size)}</span></label></li>`).join("")}</ul>
      </details>`).join("")}
    <div class="actions"><button type="button" class="primary" data-act="wake">Wake up</button></div>`;
  ctx.ui.appendChild(panel);
  requestAnimationFrame(() => panel.classList.add("on"));
  return {
    el: panel,
    wake: () => until((resolve) => {
      const go = () => {
        const ticked = {};
        for (const s of ["rest", "impostors", "banish", "keep"]) {
          const box = panel.querySelector(`details[data-key="${s}"]`);
          ticked[s] = box ? [...box.querySelectorAll("input:checked")].map((i) => i.dataset.id) : [];
        }
        resolve(ticked);
      };
      panel.querySelector('[data-act="wake"]').addEventListener("click", () => { ctx.sound.clink(0.4); go(); });
      if (ctx.settings.autoplay) setTimeout(go, 2500);
    }, ctx.signal),
    async result(r) {
      const sim = r.simulated ? " (simulated)" : "";
      panel.innerHTML = `
        <h2>Morning</h2>
        ${r.moved ? `<p class="counter"><span class="c">0</span> ${r.moved === 1 ? "soul" : "souls"} at rest · <span class="b">0 bytes</span> ready to bury${sim}</p>`
          : '<p class="counter">Nothing moved. Every file is where you left it.</p>'}
        ${r.skipped.length ? `<p class="skipped">${r.skipped.length === 1 ? "One file" : r.skipped.length + " files"} stayed where ${r.skipped.length === 1 ? "it was" : "they were"}: ${r.skipped.slice(0, 3).map((s) => `${esc(s.name)} (${esc(s.reason)})`).join("; ")}${r.skipped.length > 3 ? "…" : ""}</p>` : ""}
        <p class="tiny"></p>
        <p class="small note" style="opacity:0;transition:opacity .8s">Everything rests in the Crypt. Resurrect any of it with one click, or bury it yourself when you are ready.</p>
        <div class="actions" style="opacity:0;transition:opacity .8s"><button type="button" data-act="crypt">Open the Crypt</button><button type="button" class="primary" data-act="close">Close</button></div>`;
      const c = panel.querySelector(".c"), b = panel.querySelector(".b");
      if (c) await tween(1400, (k) => { c.textContent = Math.round(r.moved * k); b.textContent = humanSize(Math.round(r.bytes * k)); }, ctx.signal);
      return panel;
    }
  };
}

/** The doppelgänger cursor: a second, translucent arrow that copies yours half a second late. */
export function twinCursor(stage) {
  const g = new PIXI.Graphics();
  g.lineStyle(1.5, 0x0b0f12, 0.9).beginFill(0xffffff, 0.95)
    .drawPolygon([0, 0, 0, 21, 5, 16, 9, 25, 12.5, 23.5, 8.5, 15, 15, 15]).endFill();
  g.alpha = 0;
  stage.layers.cursor.addChild(g);
  const off = stage.add((t) => {
    const p = stage.pointerAgo(0.5);
    g.position.set(p.x, p.y);
    g.alpha = 0.38 + 0.08 * Math.sin(t * 9);
  });
  return () => { off(); g.destroy(); };
}

/** A soft warm glow at the pointer: your cursor is the candle that lights the spirits. Set `.gutter` (0..1). */
export function candle(stage) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,236,190,.9)"); gr.addColorStop(0.15, "rgba(255,210,140,.55)"); gr.addColorStop(0.4, "rgba(255,170,90,.12)"); gr.addColorStop(1, "rgba(255,150,60,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const s = new PIXI.Sprite(PIXI.Texture.from(c)); s.anchor.set(0.5); s.blendMode = PIXI.BLEND_MODES.ADD; s.alpha = 0;
  stage.layers.cursor.addChild(s);
  const ctl = { gutter: 0, bright: 1 };
  const off = stage.add((t) => {
    const g = ctl.gutter, flick = stage.reduced ? 0 : (0.08 + 0.3 * g) * Math.sin(t * (13 + 9 * g)) + (0.05 + 0.2 * g) * Math.sin(t * 29) + g * 0.15 * (Math.random() - 0.5);
    s.position.set(stage.ptr.x, stage.ptr.y);
    s.alpha = stage.ptr.seen ? 0.55 * ctl.bright * (1 - 0.3 * g) : 0;
    s.scale.set((0.9 + flick) * 1.6 * (1 - 0.35 * g) * ctl.bright);
    stage.sys.lightI = (stage.sys.candleLight ?? 1) * (1 - 0.4 * g + flick * 0.6);
  });
  ctl.stop = () => { off(); stage.sys.lightI = 1; s.destroy({ texture: true, baseTexture: true }); };
  return ctl;
}
