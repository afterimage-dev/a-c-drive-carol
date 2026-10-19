// Stave Three · The Ghost of Filesystems Present. Exact duplicates line up and argue over which of them is real,
// each from its strongest real claim. He has as many lagging copies of himself as the group has impostors, and a
// second cursor copies yours half a second late. "Impostors, begone!"

import { title, dock, presentRow, twinCursor, humanSize } from "../ui.js";
import { wait, until, pickOne, countWords } from "../util.js";

export async function present(ctx) {
  const { stage, talk, night, sound, signal, decisions } = ctx;
  const { H } = stage;
  await title(ctx, "Stave Three", "The Second of the Three Spirits");

  stage.ramp = "present";
  stage.setCellFor(H * 0.58);
  const sp = stage.summon("present", { home: [0.5, 0.38], height: 0.56, wander: [0.03, 0.02], flip: false, alpha: 0 });
  const groups = night.present.groups;
  sp.sp.setTwins(1);
  sound.whoosh(1.4, 0.07);
  stage.glitch(0.3);
  sp.fadeTo(1, 1.2);
  await wait(1200, signal);
  const say = (text, o = {}) => talk.say(text, { voice: "present", puppet: sp, signal, ...o });

  await say("Come in! Come in, and know me better, man!");
  await say("I am the Ghost of Filesystems Present. Look upon me!");

  if (!groups.length) {
    sp.sp.setTwins(0);
    await say(night.lines.emptyPresent);
  } else {
    const n = night.present.extraCopies;
    await say(`Have you never met my brothers? You have kept ${countWords(n)} of them.`);
    await say("Identical, every one, to the very last byte.");

    const stopCursor = twinCursor(stage);
    const tally = document.createElement("div");
    tally.className = "tally";
    ctx.ui.appendChild(tally);
    let impostors = 0, impostorBytes = 0, begoneSaid = false;
    const updateTally = () => { tally.textContent = `${impostors} ${impostors === 1 ? "impostor" : "impostors"} · ${humanSize(impostorBytes)}${night.simulatedSizes ? " (simulated)" : ""}`; tally.classList.toggle("on", impostors > 0); };
    const bar = dock(ctx, "Which one is real?", [["enough", "Enough, spirit"]], { accent: "#9dff9f" });
    const enough = bar.choice().then(() => "enough");
    const rowTop = Math.min(H * 0.62, (ctx.floorY ?? H) - 300);

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      sp.sp.setTwins(Math.min(6, g.files.length - 1));
      sp.s.twin = 1;
      sp.s.begone = false;
      stage.glitch(0.2, 0.5);
      const row = presentRow(ctx, g, { top: rowTop });
      sp.s.laugh = 0.6;
      await row.argue();
      if (gi === 0) {
        await say("The test cannot tell them apart. So listen to them.");
        await say("The eldest, in the tidiest house, has the best claim. But the choice is yours.");
      }
      if (ctx.settings.autoplay) setTimeout(() => row.choose(gi % 2 === 0 ? g.original : "all"), 1500);
      const picked = await Promise.race([row.choice(), enough, until(() => {}, signal)]);
      if (picked === "enough") { await row.remove(); break; }
      if (picked === "all") {
        g.files.forEach((f) => decisions.add("keep", f));
        await row.remove();
        await say(pickOne(night.lines.presentReactions.keepAll));
      } else {
        const fakes = g.files.filter((f) => f.id !== picked && !f.cloudSynced);
        fakes.forEach((f) => decisions.add("impostors", f));
        impostors += fakes.length; impostorBytes += fakes.reduce((s, f) => s + f.size, 0);
        row.fall(picked);
        const line = begoneSaid ? pickOne(night.lines.presentReactions.chooseReal) : "Impostors, begone!";
        begoneSaid = true;
        setTimeout(() => { sp.s.begone = true; stage.glitch(0.3, 1); sound.glitch(0.3); sp.s.laugh = 1; }, 600);
        updateTally();
        await say(line, { hold: 1600 });
        await row.remove();
      }
    }
    bar.hide();
    sp.s.begone = false;
    await say("My life upon this disk is very brief. It ends tonight.");
    await say("Hark! The time is drawing near.");
    // his copies vanish one by one, newest first, and then he goes too
    for (let k = sp.sp.twinCount; k > 0; k--) { sp.sp.setTwins(k - 1); stage.glitch(0.15, 0.6); sound.glitch(0.12); await wait(350, signal); }
    stopCursor();
    tally.classList.remove("on");
    setTimeout(() => tally.remove(), 500);
  }
  sp.fadeTo(0, 1.4);
  stage.glitch(0.35);
  await wait(1600, signal);
  sp.remove();
  stage.sys.clearParticles();
}
