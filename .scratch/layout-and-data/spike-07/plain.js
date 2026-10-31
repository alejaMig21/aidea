// Plain JavaScript docking prototype. Throwaway. Works on the declared PANELS registry (id, title, min).
import { PANELS, makeContent } from "./content.js";
const SASH = 8, HEAD = 34;
const ids = Object.keys(PANELS), contents = Object.fromEntries(ids.map((id) => [id, makeContent(id)]));
const app = document.getElementById("app"), preview = document.getElementById("preview"), ghost = document.getElementById("ghost");
const mk = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
const g = (ps) => ({ t: "g", ps, a: ps[0] });
let tree = { t: "s", dir: "row", ch: ids.map((id) => g([id])), w: [380, 200, 240, 800, 240, 540] };

// Minimum size of a node along axis 0 (width) or 1 (height).
const minOf = (n, ax) => n.t === "g" ? Math.max(...n.ps.map((p) => PANELS[p].min[ax]))
  : n.dir === (ax ? "col" : "row") ? n.ch.reduce((s, c) => s + minOf(c, ax), 0) + SASH * (n.ch.length - 1) : Math.max(...n.ch.map((c) => minOf(c, ax)));

function norm(n) { // drop empty groups, collapse one-child splits, flatten same-direction nesting
  if (n.t === "g") return n.ps.length ? n : null;
  const ch = [], w = [];
  n.ch.forEach((c, i) => { const k = norm(c); if (!k) return;
    if (k.t === "s" && k.dir === n.dir) { const sum = k.w.reduce((a, b) => a + b, 0); k.ch.forEach((kc, j) => { ch.push(kc); w.push(n.w[i] * k.w[j] / sum); }); } else { ch.push(k); w.push(n.w[i]); } });
  if (!ch.length) return null;
  return ch.length === 1 ? ch[0] : { t: "s", dir: n.dir, ch, w };
}

function render() {
  const scroll = Object.fromEntries(ids.map((id) => [id, contents[id].scrollTop]));
  app.replaceChildren(build(tree));
  ids.forEach((id) => { contents[id].scrollTop = scroll[id]; });
}
function build(n) {
  if (n.t === "g") {
    const grp = mk("div", "group"), tabs = mk("div", "tabs"), body = mk("div", "gbody"); grp._n = n; grp.setAttribute("role", "group");
    n.ps.forEach((id) => { const b = mk("button", "tab" + (id === n.a ? " active" : "")); b.textContent = PANELS[id].title; b.dataset.tab = id; b.setAttribute("aria-pressed", id === n.a);
      b.onclick = () => { n.a = id; render(); }; b.onpointerdown = (e) => startDrag(e, id); tabs.append(b); });
    n.ps.forEach((id) => { contents[id].classList.toggle("off", id !== n.a); body.append(contents[id]); });
    grp.append(tabs, body); return grp;
  }
  const s = mk("div", "split " + (n.dir === "row" ? "sr" : "sc")), horiz = n.dir === "row"; s._n = n;
  n.ch.forEach((c, i) => {
    if (i) s.append(sash(n, i - 1, horiz));
    const cell = mk("div", "cell"); cell.style.flexGrow = n.w[i];
    cell.style.setProperty("--mw", minOf(c, 0) + "px"); cell.style.setProperty("--mh", minOf(c, 1) + "px"); cell.append(build(c)); s.append(cell);
  });
  return s;
}

function sash(n, i, horiz) {
  const s = mk("div", "sash"); s.tabIndex = 0; s.setAttribute("role", "separator"); s.setAttribute("aria-orientation", horiz ? "vertical" : "horizontal");
  const begin = () => { const cells = [...s.parentElement.children].filter((c) => c.classList.contains("cell")), px = cells.map((c) => c.getBoundingClientRect()[horiz ? "width" : "height"]);
    px.forEach((v, k) => { n.w[k] = v; cells[k].style.flexGrow = v; }); return { cells, a: px[i], tot: px[i] + px[i + 1] }; };
  const set = (st, d) => { const na = Math.min(Math.max(st.a + d, minOf(n.ch[i], horiz ? 0 : 1)), st.tot - minOf(n.ch[i + 1], horiz ? 0 : 1));
    n.w[i] = na; n.w[i + 1] = st.tot - na; st.cells[i].style.flexGrow = na; st.cells[i + 1].style.flexGrow = st.tot - na; return na - st.a; };
  s.onpointerdown = (e) => { s.setPointerCapture(e.pointerId); s.classList.add("on"); const st = begin(), p0 = horiz ? e.clientX : e.clientY;
    s.onpointermove = (ev) => set(st, (horiz ? ev.clientX : ev.clientY) - p0); s.onpointerup = () => { s.classList.remove("on"); s.onpointermove = s.onpointerup = null; }; };
  s.onkeydown = (e) => { const k = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key]; if (!k) return; e.preventDefault(); const st = begin(); set(st, k * 20); };
  return s;
}

// ---- drag a Panel by its title, with a landing preview ----
function hit(x, y) {
  const grp = document.elementsFromPoint(x, y).find((e) => e.classList?.contains("group")); if (!grp) return null;
  const r = grp.getBoundingClientRect(), fx = (x - r.left) / r.width, fy = (y - r.top) / r.height;
  const zone = y < r.top + HEAD ? "center" : fx < .25 ? "left" : fx > .75 ? "right" : fy < .25 ? "top" : fy > .75 ? "bottom" : "center";
  return { node: grp._n, zone, r };
}
function showPreview(d) {
  if (!d) { preview.style.display = "none"; return; }
  const { r, zone } = d, h = zone === "left" || zone === "right", half = zone === "center" ? 1 : .5;
  const x = zone === "right" ? r.left + r.width / 2 : r.left, y = zone === "bottom" ? r.top + r.height / 2 : r.top;
  Object.assign(preview.style, { display: "block", left: x + "px", top: y + "px", width: (h ? r.width * half : r.width) + "px", height: (!h && zone !== "center" ? r.height * half : r.height) + "px" });
}
function startDrag(e, id) {
  const x0 = e.clientX, y0 = e.clientY; let on = false, d = null;
  const move = (ev) => { if (!on && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return; on = true;
    ghost.textContent = PANELS[id].title; Object.assign(ghost.style, { display: "block", left: ev.clientX + 8 + "px", top: ev.clientY + 8 + "px" }); d = hit(ev.clientX, ev.clientY); showPreview(d); };
  const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); ghost.style.display = preview.style.display = "none"; if (on && d) moveTo(id, d); };
  addEventListener("pointermove", move); addEventListener("pointerup", up);
}
function parentOf(n, t = tree) { if (t.t === "g") return null; for (const c of t.ch) { if (c === n) return t; const p = parentOf(n, c); if (p) return p; } return null; }
function moveTo(id, { node, zone }) {
  if (node.ps.length === 1 && node.ps[0] === id) return;
  if (zone === "center" && node.ps.includes(id)) return;
  const walk = (n) => { if (n.t === "g") { const k = n.ps.indexOf(id); if (k >= 0) { n.ps.splice(k, 1); n.a = n.ps[0]; } } else n.ch.forEach(walk); }; walk(tree);
  if (zone === "center") { node.ps.push(id); node.a = id; }
  else {
    const dir = zone === "left" || zone === "right" ? "row" : "col", before = zone === "left" || zone === "top", ng = g([id]), p = parentOf(node);
    if (p && p.dir === dir) { const i = p.ch.indexOf(node), half = p.w[i] / 2; p.w[i] = half; p.ch.splice(before ? i : i + 1, 0, ng); p.w.splice(before ? i : i + 1, 0, half); }
    else { const wrap = { t: "s", dir, ch: before ? [ng, node] : [node, ng], w: [1, 1] }; if (p) p.ch[p.ch.indexOf(node)] = wrap; else tree = wrap; }
  }
  tree = norm(tree); render();
}

// ---- serialise / restore ----
function snapshot() { document.querySelectorAll(".split").forEach((s) => { const n = s._n, cells = [...s.children].filter((c) => c.classList.contains("cell")); cells.forEach((c, k) => { n.w[k] = c.getBoundingClientRect()[n.dir === "row" ? "width" : "height"]; }); }); }
const strip = (n) => n.t === "g" ? { t: "g", ps: n.ps.filter((p) => PANELS[p]), a: n.a } : { t: "s", dir: n.dir, ch: n.ch.map(strip), w: n.w };
window.spike = {
  engine: "plain", groupSel: ".group", sashSel: ".sash",
  json: () => { snapshot(); return JSON.parse(JSON.stringify(tree)); },
  restore: (j) => { tree = norm(strip(j)); render(); },
  panelRect: (id) => contents[id].getBoundingClientRect().toJSON(),
  groupRect: (id) => contents[id].closest(".group").getBoundingClientRect().toJSON(),
  tabPoint: (id) => { const r = document.querySelector(`[data-tab="${id}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
  visible: (id) => contents[id].offsetParent !== null,
  previewShown: () => getComputedStyle(preview).display !== "none",
};
render();
