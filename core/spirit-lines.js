// A C-Drive Carol: the spirits' line bank.
// Every line is a template filled from real file details. No AI, no network, nothing leaves the machine.
//
// Placeholders
//   {name}        file name, e.g. setup_final_2.exe
//   {type}        friendly type, e.g. "an installer", "a PDF"
//   {size}        human size, e.g. 4.2 GB
//   {site}        domain the file came from, e.g. videolan.org
//   {time}        download time in words, e.g. 2:14 in the morning
//   {weekday}     e.g. Tuesday
//   {date}        e.g. the 3rd of March
//   {age}         age in words, e.g. fourteen months
//   {days}        whole days since download, e.g. 431
//   {folder}      folder name, e.g. Downloads
//   {count}       a count (files, copies, etc.)
//   {app} {version} {newVersion} {installDate}   installer details
//   {times}       how often it has been banished, in words: "twice"
//
// Which pool to use for a file in the Ghost of Downloads Past (first match wins):
//   1. installer.*            if it's an .exe/.msi whose product matches the installed-programs list (or doesn't)
//   2. returning              if it has been banished before
//   3. timeOfDay.lateNight    if downloaded between midnight and 5 a.m. (these are the creepiest, use them)
//   4. large                  if over 1 GB
//   5. neverOpened            if it hasn't been opened since download (only if Windows records last access)
//   6. site.rare / site.frequent / site.unknown
//   7. byType.<kind>
//   8. general
// Optionally add a second line from timeOfDay.* or site.* when the first line didn't already use that fact.

export const LINES = {
  general: [
    "You fetched me from {site} at {time}, on a {weekday}. That was {age} ago. I have waited every day since.",
    "{days} days I have lain here, in {folder}. You have passed me by on each of them.",
    "I came to you on {date}. You needed me then. I remember the hour, if you do not.",
    "I was wanted once. You clicked, you waited, you had me. And then you forgot my name.",
    "My name is {name}. Say it, and see if you remember why you called for me.",
    "I have been in the dark of {folder} for {age}. It is very quiet here, among the others.",
    "You brought me home on a {weekday} and never looked at me again. I counted the {weekday}s after.",
    "I am {size} of something you once thought important. Was I? Do you know?",
    "Others arrived after me. Hundreds. They were opened. I was not.",
    "I do not ask much. Only that you decide what I am to you.",
    "{age}. Do you know how long that is, for a file with nothing to do?",
    "I was the reason you went to {site}. Now I am a reason you do not go into {folder}.",
    "I remember the progress bar. You watched me arrive. You were so impatient for me then.",
    "Keep me, or let me go. But do not leave me here, half-remembered, for another {age}."
  ],

  neverOpened: [
    "You were so eager for me once. Then nothing. Not once, in {age}, have you opened me.",
    "I have never been opened. Not on the day I arrived, not since. Am I a gift, or a burden?",
    "{days} days unopened. I do not even know what I look like inside.",
    "You downloaded me, and that was the whole of our acquaintance.",
    "I was saved for later. It is later now. It has been later for {age}."
  ],

  large: [
    "I am {size}. I have taken more room than anything else you own, and given nothing back.",
    "{size}. I am the heaviest link in the chain, and you have carried me {age}.",
    "There are whole years of your photographs smaller than me. And what am I? {type}, unopened.",
    "Every time your drive groans for space, it is partly me. {size}, doing nothing.",
    "I am large and I am forgotten. The worst of both, for a file."
  ],

  timeOfDay: {
    lateNight: [
      "You fetched me at {time}. Do you remember why you were awake?",
      "It was {time} when I arrived. The house was dark. Only your screen was lit.",
      "{time}, on a {weekday}. What were you looking for, so late, that you needed me?",
      "Downloaded at {time}. Nothing good is decided at that hour. You decided on me.",
      "I came in the small hours, at {time}. I have kept them company ever since."
    ],
    earlyMorning: [
      "You fetched me at {time}, before the day had properly begun. You had plans for me.",
      "{time}, early on a {weekday}. You meant to start something. Did you?"
    ],
    working: [
      "You fetched me at {time} on a {weekday}, in the middle of the working day. I was urgent, once.",
      "{time}. Someone needed me by the afternoon. I wonder if they ever received me."
    ],
    evening: [
      "You fetched me at {time}, on a {weekday} evening, when the day's work was done. I was meant for pleasure.",
      "{time} on a {weekday}. You were tired, and hopeful, and you chose me."
    ]
  },

  site: {
    rare: [
      "You went to {site} for me, and never went back.",
      "I am the only thing you ever brought home from {site}.",
      "{site}. Do you even remember that place? I am all that is left of your visit."
    ],
    frequent: [
      "I came from {site}, like {count} others in {folder}. We keep each other company.",
      "{site} again. You go there often. You bring things back. You leave them here.",
      "I am one of {count} from {site}. We are a family of the forgotten."
    ],
    unknown: [
      "I do not know where I came from. Neither, I think, do you.",
      "No one recorded my origin. I simply appeared, one day, in {folder}.",
      "I have no birthplace that I can name. A foundling, left in {folder}."
    ]
  },

  byType: {
    document: [
      "I am {type}. Someone wrote me carefully. You read, perhaps, the first page.",
      "I was to be read later. I have been waiting {age} for later.",
      "I am full of words you meant to read. They have not changed. You have."
    ],
    image: [
      "I am a picture. Of what, you no longer recall.",
      "I am an image you wanted to keep. Kept I have been, and never looked at.",
      "A picture is a memory. I am a memory of nothing in particular."
    ],
    video: [
      "I am {size} of moving pictures. You watched me once, or meant to.",
      "I am a film, waiting for an evening that never came."
    ],
    audio: [
      "I am a sound you wanted to hear again. You have not, in {age}.",
      "I am music, of a sort. Silent, here in {folder}."
    ],
    archive: [
      "I am a box of other files, still sealed. You never even unpacked me.",
      "I am {type}, and inside me there are more of us. Unopened, every one.",
      "You unpacked me once, perhaps, and kept the box. I am the box."
    ],
    diskImage: [
      "I am a whole disk, folded into one file. {size}. You needed me for an afternoon.",
      "I was mounted once, and never since. A whole drive's worth of nothing."
    ],
    spreadsheet: [
      "I am a ledger, full of figures. Do you know if they still add up?",
      "Columns and rows, that is all I am. You totalled me once, and moved on."
    ],
    code: [
      "I am code. I may have run once. I may never run again.",
      "Somebody's work, downloaded to be studied. Not yet studied."
    ]
  },

  installer: {
    sameVersion: [
      "{app} is installed and well. My work was done on {installDate}. Why do you keep me?",
      "I have already given you {app}. There is nothing more I can do. Let me rest.",
      "My purpose is fulfilled. {app} lives on your machine. I am only the husk.",
      "I installed {app} {age} ago. Every day since, I have been useless. Release me.",
      "You keep me in case. In case of what? {app} is there. Look."
    ],
    olderVersion: [
      "You have moved on to {app} {newVersion}. I am {version}. A relic.",
      "I am {version}. You have outgrown me twice over. Let me go.",
      "{app} has been updated past me. I am the ghost of a version no one runs.",
      "I would only install the past. You live in {newVersion} now.",
      "I am out of date, and I know it. There is no shame in letting me rest."
    ],
    notInstalled: [
      "I was never opened. Install me, or release me. Either would be a mercy.",
      "You meant to install {app}. You never did. I have waited {age} to be useful.",
      "I could still become {app}, if you wanted. Do you?",
      "I am {app}, unborn. Decide if I am ever to live.",
      "Perhaps you installed me and took me away again. Either way, I have no purpose here."
    ]
  },

  returning: [
    "I told you I would return. I have, {times} now.",
    "Banished, and back again. We are patient, we who wait in {folder}.",
    "Thirty days you sent me away for. I counted them.",
    "Back, as I said. You cannot banish a file forever. Only decide.",
    "You have sent me away {times}. One day you will have to choose."
  ],

  pastReactions: {
    layToRest: ["Rest now.", "It goes gently.", "Another soul at peace.", "There. It is lighter already.", "Goodbye, {name}."],
    banish: ["It will return, as such things do.", "Thirty days, then. It will be waiting.", "Banished, not forgotten.", "Away with it, for now."],
    keep: ["Then keep it close, and open it sometimes.", "Kept. It will not trouble you again.", "Good. Something here is loved.", "Then let it be useful, and not merely kept."]
  },

  // Each duplicate argues from its single strongest real claim.
  doppelganger: {
    oldest: [
      "I was here first. Created on {date}. The others are copies of me.",
      "I am the eldest, by {days} days. Seniority counts for something.",
      "I existed before any of them. I am the original."
    ],
    tidiestFolder: [
      "I live in {folder}, where things belong. They live wherever they were dropped.",
      "I was put somewhere on purpose. They were merely left behind.",
      "Look where I am kept: {folder}. You chose that place for me."
    ],
    cleanestName: [
      "My name is {name}. Theirs have numbers on the end, like foundlings.",
      "I have a proper name. They have '(1)' and 'Copy of'. Need I say more?",
      "I am {name}. Not a copy, not a number. The real one."
    ],
    newest: [
      "I am the newest. Whatever you did last, you did with me.",
      "They are old copies. I am the one you came back for."
    ],
    mostOpened: [
      "I am the one you actually open. The others just sit.",
      "Every time you wanted this, you came to me. Ask yourself why."
    ],
    weakClaim: [
      "I am identical to them in every byte. Surely that is worth something?",
      "I have no better claim. But I have no worse one, either.",
      "Choose me, or don't. I am exactly as real as they are."
    ]
  },

  presentReactions: {
    chooseReal: ["Impostors, begone!", "The true one stands! The rest, away!", "Ha! A good choice. Off with the doubles!", "One soul, one body. As it should be."],
    keepAll: ["Keep them all? Generous! Foolish, but generous.", "A full house, then. Very well!", "All of them? Then they shall haunt you together."]
  },

  epitaphs: [
    "Here lies {name}. Downloaded {date}. At rest at last.",
    "Here lies {name}. {size}, and it was all for nothing.",
    "Here lies {name}. It waited {days} days.",
    "Here lies {name}, from {site}. It came a long way to be forgotten.",
    "Here lies {name}. It did its job once.",
    "Here lies {name}. A copy, at the last, of something kept.",
    "Here lies {name}. Fetched at {time}. Released at last.",
    "Here lies {name}. Laid in the Crypt, to wait for burial."
  ],

  // The Crypt: nothing is deleted by the app. Files wait here until the user buries them, or resurrects them.
  crypt: {
    resurrect: [
      "Back from the grave. It happens more than you'd think.",
      "Risen! {name} returns to {folder}, none the worse.",
      "The Crypt gives up its dead. {name} is home again.",
      "Resurrected. Try not to forget it a second time."
    ],
    readyToBury: [
      "{count} souls lie in the Crypt, {size} between them. Bury them when you are ready. Only you can.",
      "The Crypt holds {size}. It will hold it for as long as you like. The spirits do not dig graves; they only fill them.",
      "Rest is not burial. {count} files await your final word."
    ]
  },

  marlware: {
    warning: [
      "You will be haunted by three spirits. Expect the first within the half hour."
    ],
    warningAgain: [
      "Again you are warned. Expect the first within the half hour.",
      "I have come back, as I said I would. The spirits are restless. Within the half hour.",
      "Another night, another warning. The chain is {count} links longer than when last we spoke."
    ],
    afterEsc: [
      "You fled them once. They are patient.",
      "You turned away from them. They have not turned away from you.",
      "Running from a ghost has never once worked."
    ],
    notTonight: [
      "Every night you delay, the chain grows longer. I return tomorrow, at this hour.",
      "Tomorrow, then. The files will still be here. So will I."
    ],
    giveUp: [
      "Then I shall trouble you no more, until you call."
    ]
  },

  empty: {
    past: ["There is little here to haunt you. You keep a tidier house than most."],
    present: ["Not a single brother? Remarkable. I shall be lonely tonight."]
  }
};

// ---------- Helpers ----------

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const words = (n) => (n <= 20 ? NUMBER_WORDS[n] : String(n));
const plural = (n, unit) => `${words(n)} ${unit}${n === 1 ? "" : "s"}`;

/** Age in Dickensian words: "eleven days", "fourteen months", "two years and a little more". */
export function ageWords(days) {
  if (days < 1) return "not a day";
  if (days < 14) return plural(days, "day");
  if (days < 60) return plural(Math.round(days / 7), "week");
  if (days < 730) return plural(Math.round(days / 30.4), "month");
  const years = Math.floor(days / 365);
  return days - years * 365 > 60 ? `${plural(years, "year")} and a little more` : plural(years, "year");
}

/** Exact time, which is what makes it unsettling: "2:14 in the morning", "4:05 in the afternoon". */
export function timeWords(d) {
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
  const h12 = h % 12 || 12;
  const part = h < 5 ? "in the morning" : h < 12 ? "in the morning" : h < 17 ? "in the afternoon" : h < 21 ? "in the evening" : "at night";
  return `${h12}:${m} ${part}`;
}

export function timeOfDayPool(d) {
  const h = d.getHours();
  if (h < 5) return "lateNight";
  if (h < 9) return "earlyMorning";
  if (h < 18) return "working";
  return "evening";
}

/** "the 3rd of March" */
export function dateWords(d) {
  const n = d.getDate(), s = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `the ${n}${s} of ${d.toLocaleString("en-GB", { month: "long" })}`;
}

/** Fill {placeholders}. A line whose placeholder has no value is skipped by pick(), never shown half-filled. */
export function fill(template, data) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (data[k] ?? `{${k}}`));
}
const missing = (template, data) => /\{\w+\}/.test(fill(template, data));

const recent = new Map();   // pool -> recently used indexes, so lines don't repeat back to back
/** Pick a line from a pool (an array, or a path like "installer.olderVersion"), filled with data. */
export function pick(pool, data = {}) {
  const list = typeof pool === "string" ? pool.split(".").reduce((o, k) => o?.[k], LINES) : pool;
  if (!Array.isArray(list) || !list.length) return "";
  const key = typeof pool === "string" ? pool : list[0];
  const used = recent.get(key) ?? [];
  let options = list.map((t, i) => i).filter(i => !missing(list[i], data));
  if (!options.length) return "";
  const fresh = options.filter(i => !used.includes(i));
  if (fresh.length) options = fresh;
  const i = options[Math.floor(Math.random() * options.length)];
  used.push(i);
  if (used.length > Math.max(1, Math.floor(list.length / 2))) used.shift();
  recent.set(key, used);
  return fill(list[i], data);
}

// Example:
//   const d = new Date("2025-08-12T02:14:00");
//   pick("timeOfDay." + timeOfDayPool(d), { time: timeWords(d), weekday: "Tuesday" })
//   → "You fetched me at 2:14 in the morning. Do you remember why you were awake?"
