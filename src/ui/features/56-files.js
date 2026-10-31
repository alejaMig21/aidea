// Files panel: the folder hierarchy of the open Project (GET /files), a tree whose folders open and close. It is read-only and shows what the
// core lists: ignored folders (dependencies, caches, build output, version control) stay closed, a file in a language aidea can read says which.
// The tree is asked for only while the panel is on screen, because the core reads the whole folder to answer. Names are prefixed "files".
{
  const style = document.createElement("style");
  style.textContent = `
    #pane-files { padding: 8px 0; gap: 0; }
    #pane-files .files-note { padding: 8px 14px; font-size: 12px; color: var(--muted); }
    #pane-files ul { list-style: none; margin: 0; padding: 0; display: block; }
    #pane-files .files-row { display: flex; align-items: center; gap: 6px; width: 100%; min-height: 26px; padding: 2px 14px 2px calc(14px + var(--depth) * 14px); border: 0; border-radius: 0; background: transparent; color: var(--text); font: 13px var(--sans); text-align: left; }
    #pane-files button.files-row { cursor: pointer; }
    #pane-files button.files-row:hover { background: var(--raised); }
    #pane-files .files-row .files-caret { flex: none; width: 10px; font-size: 11px; color: var(--muted); }
    #pane-files .files-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #pane-files .files-tag { flex: none; font-size: 12px; color: var(--muted); }
    #pane-files .files-plain .files-name, #pane-files .files-ignored .files-name { color: var(--muted); }
    #pane-files .files-ignored .files-name { font-style: italic; }
    #pane-files .files-empty, #pane-files .files-more { padding: 2px 14px 2px calc(14px + var(--depth) * 14px); font-size: 12px; color: var(--muted); }
  `;
  document.head.append(style);
}

const filesPane = $("pane-files");
const filesOpenFolders = new Set(); // the folders the person opened, kept while the tree is read again
let filesLoadedFor = null; // the Project whose tree is on screen
let filesStale = true; // the tree on screen may differ from the disk (a refresh happened while the panel was hidden)
let filesRequest = 0;

const filesEl = (tag, props = {}, ...children) => { const e = Object.assign(document.createElement(tag), props); e.append(...children); return e; };

function filesNote(text) { filesPane.replaceChildren(filesEl("p", { className: "files-note", textContent: text })); }

function filesRow(entry, depth) {
  const li = filesEl("li", {});
  li.setAttribute("role", "treeitem");
  li.style.setProperty("--depth", depth);
  if (entry.kind === "file") {
    const row = filesEl("div", { className: `files-row${entry.analysed ? "" : " files-plain"}` }, filesEl("span", { className: "files-caret" }), filesEl("span", { className: "files-name", textContent: entry.name, title: entry.path }));
    row.style.setProperty("--depth", depth);
    if (entry.language) row.append(filesEl("span", { className: "files-tag", textContent: entry.language }));
    li.append(row);
    return li;
  }
  const ignored = entry.ignored === true;
  const row = filesEl(ignored ? "div" : "button", { className: `files-row${ignored ? " files-ignored" : ""}`, title: ignored ? `${entry.path}: not opened (dependencies, caches, build output or version control)` : entry.path }, filesEl("span", { className: "files-caret", textContent: ignored ? "" : "▸" }), filesEl("span", { className: "files-name", textContent: entry.name }));
  row.style.setProperty("--depth", depth);
  li.append(row);
  if (ignored) return li;
  row.type = "button";
  let group = null;
  const setOpen = (open) => {
    li.setAttribute("aria-expanded", String(open));
    row.querySelector(".files-caret").textContent = open ? "▾" : "▸";
    if (open) filesOpenFolders.add(entry.path); else filesOpenFolders.delete(entry.path);
    if (open && !group) { group = filesList(entry, depth + 1); li.append(group); } // the children are drawn the first time the folder opens, so a huge tree costs nothing until it is opened
    if (group) group.hidden = !open;
  };
  row.onclick = () => setOpen(li.getAttribute("aria-expanded") !== "true");
  setOpen(filesOpenFolders.has(entry.path));
  return li;
}

function filesList(folder, depth) {
  const ul = filesEl("ul", {});
  ul.setAttribute("role", "group");
  const children = folder.children ?? [];
  if (!children.length && !folder.truncated) {
    const none = filesEl("li", { className: "files-empty", textContent: "Empty" });
    none.style.setProperty("--depth", depth);
    ul.append(none);
  }
  for (const child of children) ul.append(filesRow(child, depth));
  if (folder.truncated) {
    const more = filesEl("li", { className: "files-more", textContent: `${folder.truncated} more entries are not shown. Open the folder in your editor to see them.` });
    more.style.setProperty("--depth", depth);
    ul.append(more);
  }
  return ul;
}

async function filesLoad() {
  const project = current;
  if (!project) { filesLoadedFor = null; filesNote("Open a Project to see its files."); return; }
  const mine = ++filesRequest;
  if (filesLoadedFor !== project) filesNote("Reading the files...");
  try {
    const res = await fetch(`/files?project=${encodeURIComponent(project)}`);
    const body = await res.json();
    if (mine !== filesRequest) return; // a newer request answers
    if (!res.ok) { filesLoadedFor = null; filesNote(body.error ?? "The files could not be read."); return; }
    if (filesLoadedFor !== project) filesOpenFolders.clear(); // another Project: its folders start closed
    filesLoadedFor = project;
    filesStale = false;
    const tree = filesList({ children: body.root, truncated: body.truncated }, 0);
    tree.setAttribute("role", "tree");
    tree.setAttribute("aria-label", "Project files");
    filesPane.replaceChildren(tree);
  } catch {
    if (mine === filesRequest) { filesLoadedFor = null; filesNote("Could not reach aidea to read the files."); }
  }
}

// Reads the tree when the panel is on screen and what it shows is missing or out of date.
function filesEnsure() {
  if (typeof layoutShown === "undefined" || !layoutShown.files) return;
  if (filesLoadedFor !== current || filesStale) filesLoad();
}

document.addEventListener("project-opened", () => { filesStale = true; filesEnsure(); });
document.addEventListener("project-refreshed", () => { filesStale = true; filesEnsure(); });
document.addEventListener("layout-applied", filesEnsure);
filesNote("Open a Project to see its files.");
