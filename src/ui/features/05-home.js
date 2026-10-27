// Home: shown while no Project is open. Lists the recent Projects the core remembers.
// Names here are prefixed "home" because every feature file shares one global scope.
const homeText = (tag, cls, content) => Object.assign(document.createElement(tag), { className: cls, textContent: content });

async function refreshHome() {
  const recents = await (await fetch("/recents")).json();
  $("home-empty").hidden = recents.length > 0;
  $("recents").replaceChildren(...recents.map((r) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.className = "open";
    b.disabled = !r.available;
    b.append(
      homeText("strong", "", r.name),
      homeText("span", "path", r.available ? r.path : `${r.path} (folder not found)`),
      homeText("span", "when", `Last opened ${new Date(r.openedAt).toLocaleString()}`),
    );
    b.onclick = () => open(r.path);
    li.append(b);
    if (!r.available) {
      const f = homeText("button", "forget", "Forget");
      f.title = "Remove from this list; the folder is not touched";
      f.onclick = async () => {
        await fetch("/recents/forget", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: r.path }) });
        refreshHome();
      };
      li.append(f);
    }
    return li;
  }));
}
// Open folder: the desktop shell's picker when present (window.aidea), else focus the typed path box.
$("home-open").onclick = async () => {
  if (!window.aidea) return $("path").focus();
  const folder = await window.aidea.pickFolder();
  if (folder) open(folder);
};
const hideHome =() => { $("home").hidden = true; };
refreshHome();
