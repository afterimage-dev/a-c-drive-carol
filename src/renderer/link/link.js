// One link of Marlware's chain, lying where he dropped it. Touch it and it rattles; click it to pick it up.
import { Sound } from "../overlay/audio.js";

const carol = window.carol;
const params = new URLSearchParams(location.search);
const sound = new Sound();
sound.configure({ sound: params.get("sound") === "1", volume: Number(params.get("volume")) || 0.5 });
const cv = document.getElementById("c"), g = cv.getContext("2d");
const dpr = devicePixelRatio || 1;
cv.width = 180 * dpr; cv.height = 110 * dpr; cv.style.width = "180px"; cv.style.height = "110px";
g.scale(dpr, dpr);

const img = new Image();
img.src = "../../../assets/sprites/link.webp";
const L = { x: 90, y: 84, w: 46, h: 61 };   // lying on its side at the bottom
let wobble = 0, taken = 0, over = false, t = 0, last = performance.now();

function draw(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  wobble *= Math.exp(-dt * 3.2);
  if (taken) taken += dt;
  g.clearRect(0, 0, 180, 110);
  const glow = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, 60);
  const a = (0.16 + 0.05 * Math.sin(t * 1.3) + (over ? 0.08 : 0)) * (1 - Math.min(1, taken * 1.5));
  glow.addColorStop(0, `rgba(143,240,238,${a})`); glow.addColorStop(1, "rgba(143,240,238,0)");
  g.fillStyle = glow; g.fillRect(0, 0, 180, 110);
  const rot = Math.PI / 2 - 0.18 + wobble * Math.sin(t * 38) * 0.35;
  const hop = -Math.abs(wobble * Math.sin(t * 19)) * 10;
  const alpha = 1 - Math.min(1, taken * 1.5);
  if (img.complete && alpha > 0) {
    const split = taken ? taken * 30 : 0;
    for (const [dx, tint] of split ? [[-split, "#ff4fd8"], [split, "#4ff7ff"], [0, null]] : [[0, null]]) {
      g.save();
      g.globalAlpha = tint ? alpha * 0.5 : alpha * (0.85 + 0.1 * Math.sin(t * 2.3));
      g.translate(L.x + dx, L.y + hop); g.rotate(rot);
      g.drawImage(img, -L.w / 2, -L.h / 2, L.w, L.h);
      g.restore();
    }
  }
  if (taken > 0.8) { carol.taken(); return; }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

const near = (e) => Math.hypot(e.clientX - L.x, e.clientY - L.y) < 38;
addEventListener("mousemove", (e) => {
  const now = near(e);
  if (now === over) return;
  over = now;
  carol.hover(over);
  if (over && !taken) {   // the cursor touched it: it rattles
    wobble = 1;
    for (let i = 0; i < 3; i++) sound.clink(0.5 - i * 0.12, (L.x / 180) - 0.5, 0.5, i * 0.09, { heavy: true });
  }
});
addEventListener("mouseleave", () => { if (over) { over = false; carol.hover(false); } });
addEventListener("click", (e) => {
  if (!near(e) || taken) return;
  taken = 0.001;
  sound.glitch(0.25);
});
