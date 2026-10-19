// Real Windows file icons for the files the spirits show, as data URLs. Missing files are simply left out.

import { app, nativeImage } from "electron";

export async function iconsFor(files) {
  const out = {};
  await Promise.all(files.map(async (f) => {
    try {
      const img = await app.getFileIcon(f.path, { size: "large" });
      if (!img.isEmpty()) out[f.id] = img.toDataURL();
    } catch { /* no icon: the renderer draws a plain page */ }
  }));
  return out;
}

const PREVIEWABLE = new Set(["image", "video"]);
/** Small previews, made by Windows as Explorer makes them, for pictures, videos and PDFs. */
export async function thumbnailsFor(files, size = { width: 260, height: 180 }) {
  const out = {};
  await Promise.all(files.filter((f) => PREVIEWABLE.has(f.kind) || /\.pdf$/i.test(f.name)).map(async (f) => {
    try {
      const img = await nativeImage.createThumbnailFromPath(f.path, size);
      if (!img.isEmpty()) out[f.id] = img.toDataURL();
    } catch { /* no preview: the card shows the icon alone */ }
  }));
  return out;
}
