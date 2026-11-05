// The reference menu of the Builder's composer (roles-and-contract 01): the person asks a Builder for work by writing in its chat, and may add a reference to a piece of code or to a Contract item.
// The chosen reference is written into the message as plain text the person can read and edit; nothing is sent and nothing is resolved behind their back.
// Names are prefixed "chatRef" because every feature file shares one global scope.
{
  const input = $("chat-input");
  const row = input.form.querySelector(".chat-controls");
  const select = Object.assign(document.createElement("select"), { id: "chat-ref", className: "agent-opt" });
  select.setAttribute("aria-label", "Add a reference to the message");
  row.insertBefore(select, row.querySelector("button"));

  const MAX_CODE = 80;
  const option = (label, text) => Object.assign(document.createElement("option"), { textContent: label, value: text });
  const group = (label, options) => { const g = Object.assign(document.createElement("optgroup"), { label }); g.append(...options); return g; };
  let chatRefToken = 0;

  async function chatRefRefresh(nodes) {
    const mine = ++chatRefToken, project = current;
    select.replaceChildren(option("Add a reference…", ""));
    const code = (nodes ?? []).filter((n) => ["module", "class", "function"].includes(n.kind)).slice(0, MAX_CODE)
      .map((n) => option(`${n.kind} ${n.id}`, n.kind === "module" ? `the module "${n.id}" (${n.file})` : `the ${n.kind} "${n.id}" (${n.file})`));
    if (code.length) select.append(group("Code", code));
    const body = project ? await fetch(`/contract?project=${encodeURIComponent(project)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
    if (mine !== chatRefToken || !body?.layers) return; // a newer refresh, or another Project, took over
    const items = [];
    const add = (layer, n) => { if (n?.title) items.push(option(`${layer}: ${n.title}`, `the ${layer} item "${n.title}"`)); };
    for (const list of Object.values(body.layers.business ?? {})) list.forEach((n) => add("business", n));
    (body.layers.requirements ?? []).forEach((n) => add("requirements", n));
    (body.layers.architecture ?? []).forEach((n) => add("architecture", n));
    if (items.length) select.append(group("Contract", items.slice(0, MAX_CODE)));
  }

  // Writes the reference at the cursor, with a space on each side so it reads as a sentence.
  select.addEventListener("change", () => {
    const text = select.value;
    select.selectedIndex = 0;
    if (!text) return;
    const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start;
    const before = input.value.slice(0, start), after = input.value.slice(end);
    const lead = before && !/\s$/.test(before) ? " " : "";
    input.value = `${before}${lead}${text} ${after}`;
    const caret = before.length + lead.length + text.length + 1;
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event("input", { bubbles: true })); // the box grows with its text
    input.focus();
  });

  const chatRefDrawWithout = draw;
  draw = async (nodes) => {
    await chatRefDrawWithout(nodes);
    chatRefRefresh(nodes);
  };
}
