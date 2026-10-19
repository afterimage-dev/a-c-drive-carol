// The spirits' memory between nights: files you chose to keep are never raised again, and banished files stay away
// for thirty days, then return knowing how many times they were sent off. Pure functions over settings + manifest.
// Only real nights are remembered: the sample files are rebuilt fresh for every demo.

const DAY = 86400000;
export const BANISH_DAYS = 30;

const keyOf = (p) => p.toLowerCase();
const same = (entry, f) => keyOf(entry.path) === keyOf(f.path) && entry.size === f.size;

/** The manifest as the spirits should see it tonight: kept and still-banished files removed, returning ones marked. */
export function applyMemory(m, { kept = [], banished = [] }, now = Date.now()) {
  if (m.mode !== "real") return m;
  const away = new Set(), times = new Map();
  for (const f of m.files) {
    if (kept.some((k) => same(k, f))) { away.add(f.id); continue; }
    const b = banished.find((e) => same(e, f));
    if (!b) continue;
    if (Date.parse(b.until) > now) away.add(f.id);
    else times.set(f.id, b.times || 1);
  }
  const files = m.files.filter((f) => !away.has(f.id)).map((f) => (times.has(f.id) ? { ...f, timesBanished: times.get(f.id) } : f));
  // a duplicate group needs at least two members left to still be a group
  const groups = m.groups
    .map((g) => ({ ...g, members: g.members.filter((id) => !away.has(id)) }))
    .filter((g) => g.members.length > 1);
  const grouped = new Set(groups.flatMap((g) => g.members));
  return { ...m, files: files.map((f) => (f.group && !grouped.has(f.id) ? { ...f, group: null } : f)), groups };
}

/** Settings updated with tonight's banished and kept files (and laid-to-rest ones forgotten). Returns a new object. */
export function remember(settings, m, { banish = [], keep = [], rest = [] }, now = Date.now()) {
  if (m.mode !== "real") return settings;
  const byId = new Map(m.files.map((f) => [f.id, f]));
  let kept = [...settings.kept], banished = [...settings.banished];
  for (const id of rest) {   // laid to rest: no longer banished, so it never returns as a wisp
    const f = byId.get(id); if (f) banished = banished.filter((b) => !same(b, f));
  }
  for (const id of keep) {
    const f = byId.get(id); if (!f) continue;
    banished = banished.filter((b) => !same(b, f));
    if (!kept.some((k) => same(k, f))) kept.push({ path: f.path, size: f.size });
  }
  for (const id of banish) {
    const f = byId.get(id); if (!f) continue;
    const prev = banished.find((b) => same(b, f));
    banished = banished.filter((b) => b !== prev);
    banished.push({ path: f.path, size: f.size, until: new Date(now + BANISH_DAYS * DAY).toISOString(), times: (prev?.times || 0) + 1 });
  }
  return { ...settings, kept, banished };
}

/** Banished files whose thirty days are up, for the returning wisps. */
export function returningFiles(settings, now = Date.now()) {
  return settings.banished.filter((b) => Date.parse(b.until) <= now);
}
