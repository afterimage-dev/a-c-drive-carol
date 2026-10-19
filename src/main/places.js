// Where the spirits may look, and where the Crypt lives. Pure functions (no Electron), so they can be tested.

import path from "node:path";

/** True if `p` is `dir` or inside it, comparing case-insensitively as Windows does. */
export function isInside(p, dir) {
  const a = path.resolve(p).toLowerCase(), b = path.resolve(dir).toLowerCase();
  return a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep);
}

/** Cloud-synced folders (OneDrive personal and work), from the variables OneDrive sets. */
export function cloudFolders(env = process.env) {
  const dirs = [env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial].filter(Boolean).map((d) => path.resolve(d));
  return [...new Set(dirs.map((d) => d.toLowerCase()))].map((lower) => dirs.find((d) => d.toLowerCase() === lower));
}

/**
 * The app's own folder: Documents\A C-Drive Carol. If Documents is synced to the cloud, files laid to rest there
 * would be uploaded, which breaks "nothing leaves your computer", so it falls back to the home folder instead.
 */
export function appFolder({ documents, home, cloud = [] }) {
  const synced = cloud.some((c) => isInside(documents, c));
  return path.join(synced ? home : documents, "A C-Drive Carol");
}

export const cryptFolder = (appDir) => path.join(appDir, "Crypt");
export const sampleFolder = (appDir) => path.join(appDir, "Sample");
