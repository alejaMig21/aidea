// Trace table: while a recording is replayed on the flowchart, one row per step reached so far (variables as columns, the current row
// highlighted, the printed output on the last row), a card over the bottom of the Canvas that can be folded away.
// It reads the recording Playback already holds and is redrawn on every step, so stepping back drops rows and a restart empties it.
{
  const style = document.createElement("style");
  style.textContent = `
    #trace-table { position: absolute; left: 15px; bottom: 62px; z-index: 2; width: min(620px, calc(100% - 30px)); background: var(--raised); border: 1px solid var(--control); border-radius: 12px; padding: 8px 12px; box-shadow: 0 8px 24px #0007; }
    #trace-table[hidden] { display: none; }
    #trace-table header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    #trace-table h3 { margin: 0; font: 600 10.5px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
    #trace-table-fold { padding: 2px 8px; font-size: 12px; font-weight: 400; background: transparent; color: var(--text); border: 1px solid var(--control); }
    #trace-table .scroll { max-height: min(170px, 24vh); overflow: auto; margin-top: 6px; }
    #trace-table .scroll[hidden] { display: none; }
    #trace-table table { width: 100%; border-collapse: collapse; font: 11.5px var(--mono); }
    #trace-table th { position: sticky; top: 0; background: var(--raised); text-align: left; color: var(--muted); font-weight: 600; padding: 2px 6px; border-bottom: 1px solid var(--control); }
    #trace-table td { padding: 2px 6px; border-bottom: 1px solid var(--line); color: var(--label); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #trace-table th:first-child, #trace-table td:first-child { width: 28px; }
    #trace-table td:nth-child(2) { max-width: 210px; }
    #trace-table tr.cur td { background: var(--selected); color: var(--text); }
    #trace-table td.err { color: var(--danger); }
  `;
  document.head.append(style);
}

const traceEl = (tag, props = {}, ...children) => { const n = Object.assign(document.createElement(tag), props); n.append(...children); return n; };
const traceBox = Object.assign(document.createElement("div"), { id: "trace-table", hidden: true });
const traceFold = Object.assign(document.createElement("button"), { type: "button", id: "trace-table-fold", textContent: "Fold", title: "Fold the trace table away" });
traceFold.setAttribute("aria-expanded", "true");
const traceBody = Object.assign(document.createElement("div"), { className: "scroll" });
traceBox.append(traceEl("header", {}, traceEl("h3", { textContent: "Trace table" }), traceFold), traceBody);
document.querySelector("main").append(traceBox);
traceFold.onclick = () => {
  traceBody.hidden = !traceBody.hidden;
  traceFold.textContent = traceBody.hidden ? "Unfold" : "Fold";
  traceFold.setAttribute("aria-expanded", String(!traceBody.hidden));
};

function traceCell(tag, text, className) {
  const cell = Object.assign(document.createElement(tag), { textContent: notationClip(String(text), 24) });
  if (String(text).length > 24) cell.title = String(text); // the whole value stays in a tooltip
  if (className) cell.className = className;
  return cell;
}

function traceRender() {
  const rec = playbackLayer() && pbGraph ? pbRecording : null;
  traceBox.hidden = !rec;
  if (!rec) { traceBody.replaceChildren(); return; }
  const label = new Map((algoGraph?.steps ?? []).map((s) => [s.id, s.label]));
  const names = [...new Set(rec.visits.flatMap((v) => Object.keys(v.locals)))]; // columns stay put as the replay moves
  const last = rec.visits.length - 1, shown = rec.visits.slice(0, pbIndex + 1);
  const atEnd = pbIndex >= last;
  const hasOutput = Boolean(rec.output);
  const head = traceEl("tr");
  for (const name of ["#", "Step", ...names, ...(hasOutput ? ["Output"] : [])]) head.append(traceCell("th", name));
  const rows = shown.map((v, i) => {
    const tr = traceEl("tr");
    if (i === shown.length - 1) tr.className = "cur";
    tr.append(traceCell("td", i + 1), traceCell("td", label.get(v.step) ?? v.step), ...names.map((n) => traceCell("td", v.locals[n] ?? "")));
    if (hasOutput) tr.append(traceCell("td", i === last ? rec.output.trimEnd() : "")); // the run keeps one output for the whole run: it lands on the last row
    return tr;
  });
  if (atEnd && rec.error) { // a run that failed ends with an error row
    const tr = traceEl("tr");
    tr.append(traceCell("td", "!", "err"), traceCell("td", `${rec.error.type}: ${rec.error.message}`, "err"));
    rows.push(tr);
  }
  const table = traceEl("table", {}, traceEl("thead", {}, head), traceEl("tbody", {}, ...rows));
  traceBody.replaceChildren(table);
  traceBody.scrollTop = traceBody.scrollHeight; // the newest row stays in view
}

document.addEventListener("playback-step", traceRender);
document.addEventListener("algorithm-opened", () => queueMicrotask(traceRender)); // after Playback has dropped the old recording
const showLayerWithoutTrace = showLayer;
showLayer = (which) => { showLayerWithoutTrace(which); traceRender(); };
const drawWithoutTrace = draw;
draw = async (nodes) => { await drawWithoutTrace(nodes); traceRender(); };
