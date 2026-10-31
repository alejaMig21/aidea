// Files panel: the folder hierarchy of the open Project (GET /files), a tree whose folders open and close. It is read-only and shows what the
// core lists: ignored folders (dependencies, caches, build output, version control) stay closed, a file in a language aidea can read says which.
// The tree is asked for only while the panel is on screen, because the core reads the folder to answer. Names are prefixed "files".
// Keys (ARIA tree): Up and Down move between rows, Right opens a folder or enters it, Left closes it or goes to its parent, Enter and Space toggle a folder
// or choose a file: choosing a file shows its text in a tab of the Code panel (55-code.js), and the file of the tab shown there is the one marked.
{
  const style = document.createElement("style");
  style.textContent = `
    #pane-files { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 8px 0; }
    #pane-files .files-note { padding: 8px 14px; font-size: 12px; color: var(--muted); }
    #pane-files ul { list-style: none; margin: 0; padding: 0; }
    #pane-files ul[hidden] { display: none; }
    #pane-files li:focus-visible { outline: none; }
    #pane-files li:focus-visible > .files-row { outline: 2px solid var(--accent); outline-offset: -2px; }
    #pane-files .files-row { display: flex; align-items: center; gap: 6px; min-height: 26px; padding: 2px 14px 2px calc(14px + var(--depth) * 14px); color: var(--text); font: 13px var(--sans); }
    #pane-files li[aria-expanded] > .files-row:not(.files-ignored), #pane-files li[data-kind="file"] > .files-row { cursor: pointer; }
    #pane-files li[aria-expanded] > .files-row:not(.files-ignored):hover, #pane-files li[data-kind="file"] > .files-row:hover { background: var(--raised); }
    #pane-files li[aria-selected="true"] > .files-row { background: var(--selected); box-shadow: inset 3px 0 0 var(--accent); }
    #pane-files .files-caret { flex: none; width: 10px; font-size: 11px; color: var(--muted); }
    #pane-files .files-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #pane-files .files-tag { flex: none; font-size: 12px; color: var(--muted); }
    #pane-files .files-plain .files-name, #pane-files .files-ignored .files-name { color: var(--muted); }
    #pane-files .files-ignored .files-name { font-style: italic; }
    #pane-files .files-aside { padding: 2px 14px 2px calc(14px + var(--depth) * 14px); font-size: 12px; color: var(--muted); }
  `;
  document.head.append(style);
}

const filesPane = $("pane-files");
const filesOpenFolders = new Set(); // the folders the person opened, kept while the tree is read again
let filesLoadedFor = null; // the Project whose tree is on screen
let filesFailedFor = null; // the Project whose last read failed: it is not tried again until something changes
let filesSelected = null; // the path of the file chosen, shown in the Code panel
let filesLoading = false; // a read is under way: nothing starts a second one
let filesStale = true; // what is on screen may differ from the disk (the Project was opened or refreshed)

const filesEl = (tag, props = {}, ...children) => { const e = Object.assign(document.createElement(tag), props); e.append(...children); return e; };

function filesNote(text) { filesPane.replaceChildren(filesEl("p", { className: "files-note", textContent: text })); }

// A line that is not an entry (an empty folder, entries left out): it sits in the tree but is not a row to move to.
function filesAside(text, depth) {
  const li = filesEl("li", { className: "files-aside", textContent: text });
  li.setAttribute("role", "treeitem");
  li.setAttribute("aria-disabled", "true");
  li.style.setProperty("--depth", depth);
  return li;
}

function filesRow(entry, depth) {
  const li = filesEl("li", { tabIndex: -1 });
  li.setAttribute("role", "treeitem");
  li.dataset.path = entry.path;
  li.dataset.kind = entry.kind;
  const tag = entry.kind === "file" && entry.language ? [filesEl("span", { className: "files-tag", textContent: entry.language })] : [];
  const ignored = entry.ignored === true;
  const caret = filesEl("span", { className: "files-caret", textContent: entry.kind === "folder" && !ignored ? "▸" : "" });
  caret.setAttribute("aria-hidden", "true");
  const title = ignored ? `${entry.path}: listed, not opened (dependencies, caches, build output or version control)` : entry.path;
  const row = filesEl("div", { className: `files-row${ignored ? " files-ignored" : ""}${entry.kind === "file" && !entry.analysed ? " files-plain" : ""}`, title }, caret, filesEl("span", { className: "files-name", textContent: entry.name }), ...tag);
  row.style.setProperty("--depth", depth);
  li.append(row);
  if (entry.kind === "file") {
    li.setAttribute("aria-selected", String(entry.path === filesSelected));
    li.chooseFile = () => filesChoose(entry.path);
    row.onclick = () => { li.focus(); li.chooseFile(); };
    return li;
  }
  if (ignored) return li;
  let group = null;
  li.openFolder = (open) => {
    li.setAttribute("aria-expanded", String(open));
    caret.textContent = open ? "▾" : "▸";
    if (open) filesOpenFolders.add(entry.path); else filesOpenFolders.delete(entry.path);
    if (open && !group) { group = filesList(entry, depth + 1); li.append(group); } // children are drawn the first time the folder opens, so a huge tree costs nothing until it is opened
    if (group) group.hidden = !open;
  };
  row.onclick = () => { li.focus(); li.openFolder(li.getAttribute("aria-expanded") !== "true"); };
  li.openFolder(filesOpenFolders.has(entry.path));
  return li;
}

function filesList(folder, depth) {
  const ul = filesEl("ul", {});
  ul.setAttribute("role", "group");
  const children = folder.children ?? [];
  if (folder.unread) ul.append(filesAside("Not listed: this Project has too many files to read them all.", depth));
  else if (!children.length && !folder.truncated) ul.append(filesAside("Empty", depth));
  for (const child of children) ul.append(filesRow(child, depth));
  if (folder.truncated) ul.append(filesAside(`${folder.truncated} more entries are not shown. Open the folder in your editor to see them.`, depth));
  return ul;
}

// Chooses a file: it is marked and its text opens in the Code panel.
function filesChoose(path) {
  filesMark(path);
  codeOpenFile(path);
}

// Marks the file whose text the Code panel shows; the Code panel says when its tab changes (a tab chosen there, a Node's file, a tab closed).
function filesMark(path) {
  filesSelected = path;
  for (const li of filesPane.querySelectorAll("li[data-kind='file']")) li.setAttribute("aria-selected", String(li.dataset.path === path));
}
document.addEventListener("code-tab-changed", (e) => filesMark(e.detail.path));

// The rows the person can move to now: entries whose folders are all open.
const filesRows = (tree) => [...tree.querySelectorAll("li[data-path]")].filter((li) => li.offsetParent !== null);

function filesKey(tree, e) {
  const li = e.target.closest("li[data-path]");
  if (!li || e.ctrlKey || e.metaKey || e.altKey) return;
  const rows = filesRows(tree), at = rows.indexOf(li);
  const folder = !!li.openFolder, open = li.getAttribute("aria-expanded") === "true";
  const go = (row) => row?.focus();
  switch (e.key) {
    case "ArrowDown": go(rows[at + 1]); break;
    case "ArrowUp": go(rows[at - 1]); break;
    case "Home": go(rows[0]); break;
    case "End": go(rows.at(-1)); break;
    case "ArrowRight": if (folder && !open) li.openFolder(true); else if (folder) go(rows[at + 1]); break;
    case "ArrowLeft": if (folder && open) li.openFolder(false); else go(li.parentElement.closest("li[data-path]")); break;
    case "Enter": case " ": if (folder) li.openFolder(!open); else li.chooseFile(); break;
    default: return;
  }
  e.preventDefault();
}

async function filesLoad() {
  const project = current;
  if (!project) { filesLoadedFor = null; filesNote("Open a Project to see its files."); return; }
  filesLoading = true;
  filesStale = false; // a refresh that arrives during the read makes it true again, and the read is repeated
  if (filesLoadedFor !== project) filesNote("Reading the files...");
  try {
    const res = await fetch(`/files?project=${encodeURIComponent(project)}`);
    const body = await res.json();
    if (project !== current) return; // another Project was opened meanwhile: filesEnsure reads that one
    if (!res.ok) { filesLoadedFor = null; filesFailedFor = project; filesNote(body.error ?? "The files could not be read."); return; }
    if (filesLoadedFor !== project) { filesOpenFolders.clear(); filesSelected = null; } // another Project: its folders start closed and no file is chosen
    const kept = { scroll: filesPane.scrollTop, focus: document.activeElement?.closest?.("#pane-files li[data-path]")?.dataset.path };
    filesLoadedFor = project;
    filesFailedFor = null;
    const tree = filesList({ children: body.root, truncated: body.truncated }, 0);
    tree.setAttribute("role", "tree");
    tree.setAttribute("aria-label", "Project files");
    tree.onkeydown = (e) => filesKey(tree, e);
    tree.onfocusin = (e) => { for (const li of tree.querySelectorAll("li[tabindex='0']")) li.tabIndex = -1; const row = e.target.closest?.("li[data-path]"); if (row) row.tabIndex = 0; };
    filesPane.replaceChildren(tree);
    filesPane.scrollTop = kept.scroll; // a refresh keeps the place the person was at
    const first = tree.querySelector("li[data-path]");
    const back = kept.focus && [...tree.querySelectorAll("li[data-path]")].find((li) => li.dataset.path === kept.focus);
    (back ?? first)?.setAttribute("tabindex", "0"); // one stop for Tab: the row that had the focus, else the first
    if (back) back.focus();
  } catch {
    if (project === current) { filesLoadedFor = null; filesFailedFor = project; filesNote("Could not reach aidea to read the files."); }
  } finally {
    filesLoading = false;
    filesEnsure(); // the Project changed or was refreshed while this read ran
  }
}

// Reads the tree when the panel is on screen (or open as a drawer) and what it shows is missing or out of date.
// A failed read is not repeated by itself: layout changes fire this often, so only a new Project or a refresh tries again.
function filesEnsure() {
  const onScreen = typeof layoutShown !== "undefined" && (layoutShown.files || layoutDrawer === "files");
  if (!onScreen || filesLoading || !current) return; // with no Project the panel already says so
  if (!filesStale && (filesLoadedFor === current || filesFailedFor === current)) return;
  filesLoad();
}

document.addEventListener("project-opened", () => { filesStale = true; filesFailedFor = null; filesEnsure(); });
document.addEventListener("project-refreshed", () => { filesStale = true; filesFailedFor = null; filesEnsure(); });
document.addEventListener("layout-applied", filesEnsure);
filesNote("Open a Project to see its files.");
