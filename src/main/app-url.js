// Which URLs the app may load, and where app:// URLs point on disk. Pure functions, so they can be tested.

import path from "node:path";
import { isInside } from "./places.js";

export const ORIGIN = "app://carol";

/** Folders app://carol/ may serve from, relative to the app's root. Nothing else is reachable. */
export const SERVED = ["src/renderer", "core", "assets/sprites", "node_modules/pixi.js/dist", "node_modules/@pixi/unsafe-eval/dist", "node_modules/@fontsource"];

/** Schemes a window may request. Everything else (http, https, ws, ftp...) is cancelled. */
const ALLOWED = /^(app|file|data|blob|devtools|chrome-extension):/i;
export const isAllowedUrl = (url) => ALLOWED.test(String(url));

/** Resolve an app:// URL to a file inside one of the served folders, or null. */
export function resolveAppUrl(url, root) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "app:" || u.host !== "carol") return null;
  const rel = decodeURIComponent(u.pathname).replace(/^\/+/, "");
  const abs = path.resolve(root, rel);
  return SERVED.some((dir) => isInside(abs, path.join(root, dir))) ? abs : null;
}
