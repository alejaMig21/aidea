// Runs inside the real page (injected by engine-page.test.ts). A fixture that is not Data hands the animation engine a recording of pictures; the page writes what it saw as JSON into a pre element.
const report = { errors: [] };
window.addEventListener("error", (e) => { if (!String(e.message).startsWith("ResizeObserver")) report.errors.push(String(e.message)); });
const enWait = (ms) => new Promise((r) => setTimeout(r, ms));
const enList = (id, name, cells) => ({ id, kind: "list", name, data: { cells: cells.map(([cid, value]) => ({ id: cid, value })) } });
const enRecording = {
  steps: [
    { label: "start", pieces: [enList("L", "items", [["a", 1], ["b", 2]])] },
    { label: "append c", pieces: [enList("L", "items", [["a", 1], ["b", 2], ["c", 3]])] },
    { label: "swap and change", pieces: [enList("L", "items", [["b", 2], ["a", 1], ["c", 9]])] },
  ],
};
(async () => {
  try {
    const host = el("g", { id: "engine-fixture" });
    svg.append(host);
    const eng = animEngine.mount(host);
    const cells = () => [...host.querySelectorAll(".eng-cell")].map((c) => c.dataset.id);
    const tagged = (cls) => [...host.querySelectorAll(`.eng-cell.${cls}`)].map((c) => c.dataset.id);
    const tags = () => [...host.querySelectorAll(".eng-tag")].map((t) => `${t.dataset.id}:${t.textContent}`);

    eng.show(enRecording, 0);
    report.first = { pieces: [...host.querySelectorAll(".eng-piece")].map((p) => p.dataset.id), cells: cells(), tags: tags() };
    eng.show(enRecording, 1);
    report.appended = { cells: cells(), isNew: tagged("new"), tags: tags() };
    eng.show(enRecording, 2);
    report.swapped = { cells: cells(), changed: tagged("changed"), isNew: tagged("new"), tags: tags(), was: [...host.querySelectorAll(".eng-was")].map((t) => `${t.dataset.id}:${t.textContent}`) };

    // A cut piece: whoever writes the steps says how many are missing; the engine draws the note.
    const cutRecording = { steps: [{ label: "big", pieces: [{ ...enList("B", "big", [["x", 1], ["y", 2]]), data: { cells: [{ id: "x", value: 1 }, { id: "y", value: 2 }], hidden: 9900 } }] }] };
    eng.show(cutRecording, 0);
    report.cut = { notes: [...host.querySelectorAll(".eng-cut")].map((t) => t.textContent), text: eng.text(cutRecording, 0) };

    // The text form and the saved image belong to the engine.
    report.text = eng.text(enRecording, 2);
    eng.show(enRecording, 2);
    const image = eng.svg();
    report.image = { isSvg: image.includes("<svg") && image.includes("viewBox"), noVars: !image.includes("var("), cells: (image.match(/class="eng-cell/g) ?? []).length };

    // A piece added through the registry is drawn and compared like the ones that ship with aidea.
    animEngine.pieces.set("dots", {
      elements: (p) => new Map(p.data.dots.map((d) => [d.id, String(d.n)])),
      draw({ g, piece, mark, track }) { piece.data.dots.forEach((d, i) => { const c = el("circle", { class: `eng-dot${mark(d.id) ? ` ${mark(d.id)}` : ""}`, "data-id": d.id, cx: 10 + i * 24, cy: 24, r: 8 }); g.append(c); track(d.id, c, { x: i * 24, y: 0 }); }); },
      text: (p) => p.data.dots.map((d) => d.n).join(" "),
    });
    const dotsRecording = { steps: [{ label: "one", pieces: [{ id: "D", kind: "dots", data: { dots: [{ id: "p", n: 1 }] } }] }, { label: "two", pieces: [{ id: "D", kind: "dots", data: { dots: [{ id: "p", n: 1 }, { id: "q", n: 2 }] } }] }] };
    eng.show(dotsRecording, 1);
    report.dots = { drawn: [...host.querySelectorAll(".eng-dot")].map((c) => c.dataset.id), isNew: [...host.querySelectorAll(".eng-dot.new")].map((c) => c.dataset.id), text: eng.text(dotsRecording, 1) };

    // A plugin adds a piece through the slot `engine.piece`; a kind that exists, or an entry that is not complete, is refused; removing the entry removes the piece.
    const slot = pluginSlots["engine.piece"];
    const bars = { kind: "bars", elements: (p) => new Map(p.data.v.map((n, i) => [`b${i}`, String(n)])), draw({ g, piece }) { piece.data.v.forEach((n, i) => g.append(el("rect", { class: "eng-bar", x: i * 10, width: 8, height: n }))); }, text: (p) => p.data.v.join("|") };
    const refused = (entry) => { try { slot.add(entry, "fixture"); return false; } catch { return true; } };
    const removeBars = slot.add(bars, "fixture");
    const barsRecording = { steps: [{ label: "bars", pieces: [{ id: "S", kind: "bars", data: { v: [3, 5] } }] }] };
    eng.show(barsRecording, 0);
    const during = host.querySelectorAll(".eng-bar").length;
    removeBars();
    eng.show(barsRecording, 0);
    report.slot = { declared: !!slot, during, after: host.querySelectorAll(".eng-bar").length, duplicate: refused({ ...bars, kind: "list" }), incomplete: refused({ kind: "x", draw() {} }) };

    // The transition: one step forward moves what moved over a fraction of the Playback speed; with Animations off, or when jumping or going back, a step is a plain change.
    const play = (animated, from, to) => {
      const g = el("g", {}); svg.append(g);
      const e = animEngine.mount(g, { speed: () => 600, animated: () => animated });
      e.show(enRecording, from); e.show(enRecording, to);
      const all = g.getAnimations({ subtree: true }); g.remove();
      return { count: all.length, durations: [...new Set(all.map((a) => a.effect.getTiming().duration))] };
    };
    report.motion = { forward: play(true, 1, 2), off: play(false, 1, 2), jump: play(true, 0, 2), back: play(true, 2, 1) };
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "en-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
