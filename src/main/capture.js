// A picture of the primary display, taken at the bell so the visit can haunt your actual desktop.
// It stays in memory, goes only to the overlay, and is never saved.

import { desktopCapturer, screen } from "electron";

export async function captureDesktop() {
  const d = screen.getPrimaryDisplay();
  const size = { width: Math.round(d.bounds.width * d.scaleFactor), height: Math.round(d.bounds.height * d.scaleFactor) };
  try {
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: size });
    const src = sources.find((s) => String(s.display_id) === String(d.id)) || sources[0];
    if (!src || src.thumbnail.isEmpty()) return null;
    return src.thumbnail.toJPEG(88);
  } catch {
    return null;   // the visit falls back to a plain dimmed overlay
  }
}
