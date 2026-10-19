// Real Windows file icons for the files the spirits show, as data URLs. Missing files are simply left out.

import { app } from "electron";

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
