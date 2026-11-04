// Runs inside the real page (injected by data-layer-page.test.ts) and writes what it saw as JSON into a pre element.
const report = { errors: [] };
window.addEventListener("error", (e) => { if (!String(e.message).startsWith("ResizeObserver")) report.errors.push(String(e.message)); });
const dlWait = (ms) => new Promise((r) => setTimeout(r, ms));
const dlUntil = async (cond, ms = 15000) => { for (let t = 0; t < ms; t += 25) { if (await cond()) return true; await dlWait(25); } return false; };
const dlTab = () => document.querySelector('#layers button[data-layer="data"]');
const dlVar = (name) => document.querySelector(`#data [data-var="${name}"]`);
const dlText = (el) => [...(el?.querySelectorAll("text") ?? [])].map((t) => t.textContent);
const dlRecord = async (words) => {
  $("pb-v-words").value = words;
  $("pb-record").click();
  await dlUntil(() => pbRecording && pbRecording !== dlRecord.last); // a new recording is a new object (its id repeats)
  dlRecord.last = pbRecording;
  await dlWait(200);
};
(async () => {
  try {
    await openProject(window.DATA_PROJECT);
    await dlUntil(() => $("home").hidden && $("opening").hidden && document.querySelector('#world rect[data-id="tally.tally"]'));
    // The Data tab sits next to Flow in the layer bar and cannot be used before a function's Flow is open.
    const names = [...document.querySelectorAll("#layers button[data-layer]")].map((b) => b.dataset.layer);
    report.tabs = { order: names, disabledBefore: dlTab()?.disabled };

    $("world").querySelector('rect[data-id="tally.tally"]').dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await dlUntil(() => algoGraph && authoredShown === "flow" && $("pb-record"));
    report.afterFlow = { disabled: dlTab().disabled };
    dlTab().click();
    await dlWait(300);
    report.shownData = { layer: authoredShown, dataVisible: getComputedStyle($("data")).display !== "none", flowHidden: getComputedStyle($("algorithm")).display === "none", note: dlText($("data")).join(" | "), runAvailable: !!layoutShown.run || true };

    // A recording: Data follows the Playback position, with Flow.
    await dlRecord('["a", "b", "a"]');
    const last = pbRecording.visits.length - 1;
    pbGo(last);
    await dlWait(300);
    report.last = {
      vars: [...document.querySelectorAll("#data [data-var]")].map((g) => g.dataset.var),
      wordsCells: dlVar("words")?.querySelectorAll(".data-cell").length,
      wordsPositions: dlText(dlVar("words")).filter((t) => /^\d+$/.test(t)).join(","),
      countsPairs: dlVar("counts")?.querySelectorAll(".data-pair").length,
      countsText: dlText(dlVar("counts")).join(" "),
      seenCells: dlVar("seen")?.querySelectorAll(".data-cell").length,
    };
    // Stepping back and forth moves Flow and Data together, and the changed value is marked in words as well as by its look.
    const changedAt = pbRecording.visits.findIndex((v, i) => i > 0 && Object.values(v.shapes ?? {}).some((s) => s.changed && s.kind === "seq" && s.len > 0));
    pbGo(changedAt);
    await dlWait(300);
    const entry = pbRecording.visits[changedAt];
    report.together = {
      flowNow: document.querySelector("#algorithm .flow-step.now")?.dataset.step === entry.step,
      changedVars: [...document.querySelectorAll("#data .data-var.changed")].map((g) => g.dataset.var),
      tags: [...document.querySelectorAll("#data .data-changed")].map((t) => t.textContent),
      expectedChanged: Object.entries(entry.shapes).filter(([, s]) => s.changed).map(([n]) => n),
    };
    pbGo(0);
    await dlWait(300);
    report.first = { vars: [...document.querySelectorAll("#data [data-var]")].map((g) => g.dataset.var), cellsOfWords: dlVar("words")?.querySelectorAll(".data-cell").length };

    // The legend of Data is registered and its rows match what is drawn (each row somewhere in the states visited: a step that changed, the last step, a list that is cut).
    const legend = notationLegends.data;
    const rows = [...(legend?.shapes ?? []), ...(legend?.arrows ?? [])];
    const counts = rows.map(() => 0);
    const legendLook = () => rows.forEach((r, i) => { if (typeof r[2] === "string") counts[i] = Math.max(counts[i], $("data").querySelectorAll(r[2]).length); });
    pbGo(changedAt); await dlWait(200); legendLook();
    pbGo(last); await dlWait(200); legendLook();

    legendLook();
    report.legend = rows.map((r, i) => ({ text: r[1], matches: counts[i] }));

    // A very large list is cut at the limit and says how many more are hidden; drawing it stays quick. (A parameter text is limited to 10,000 characters, so the list is built by the function.)
    showLayer("components");
    await dlWait(200);
    $("world").querySelector('rect[data-id="tally.build"]').dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await dlUntil(() => algoGraph && algoGraph.node === "tally.build" && $("pb-v-n"));
    $("pb-v-n").value = "10000";
    $("pb-record").click();
    const before = pbRecording;
    await dlUntil(() => pbRecording !== before);
    dlTab().click();
    await dlWait(300);
    pbGo(0);
    const t0 = performance.now();
    pbGo(1);
    pbGo(2);
    pbGo(pbRecording.visits.length - 1);
    const elapsed = performance.now() - t0;
    await dlWait(300);
    legendLook();
    report.legend = rows.map((r, i) => ({ text: r[1], matches: counts[i] }));
    const items = dlVar("items");
    report.big = { cells: items?.querySelectorAll(".data-cell").length, hidden: dlText(items).filter((x) => /more hidden/.test(x)), elapsedMs: Math.round(elapsed) };

    // A recording that carries no values (a language that cannot record them): a plain statement, never an empty layer.
    for (const v of pbRecording.visits) delete v.shapes;
    pbGo(1);
    await dlWait(300);
    report.noValues = { note: dlText($("data")).join(" "), vars: document.querySelectorAll("#data [data-var]").length };
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "dl-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
