// Runs inside the real page (injected by chat-refs-page.test.ts): the Builder's composer offers references to the Project's code and to the Contract and writes the chosen one into the message as readable text.
const report = { errors: [] };
window.addEventListener("error", (e) => { if (!String(e.message).startsWith("ResizeObserver")) report.errors.push(String(e.message)); });
const crWait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  try {
    await crWait(1200);
    await openProject(__PROJECT__);
    await crWait(1500);
    const select = document.getElementById("chat-ref");
    report.found = !!select;
    report.label = select?.getAttribute("aria-label");
    report.groups = [...(select?.querySelectorAll("optgroup") ?? [])].map((g) => g.label);
    const options = [...(select?.querySelectorAll("option") ?? [])].map((o) => o.textContent);
    report.options = options.slice(0, 12);
    const input = document.getElementById("chat-input");
    input.value = "Please change";
    input.setSelectionRange(input.value.length, input.value.length);
    const pick = [...(select?.options ?? [])].find((o) => o.value && o.closest("optgroup")?.label === "Code");
    report.picked = pick?.textContent;
    if (pick) { select.value = pick.value; select.dispatchEvent(new Event("change", { bubbles: true })); }
    report.message = input.value;
    report.reset = select?.selectedIndex === 0;
    report.focus = document.activeElement === input;
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "cr-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
