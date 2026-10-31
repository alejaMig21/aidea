// The folded sections of the Tutor column (Plan, Differences, Contract): one line each (a title and a summary), opened with a click.
// What is open is remembered in this browser only; the page works the same when the browser keeps nothing. During a class every
// section stays folded (50-tutor.js closes them). Each section's own file fills the body and the summary.
const tutorSectionsKey = "aidea.tutor-sections";
const tutorSectionsRead = () => { try { const s = JSON.parse(localStorage.getItem(tutorSectionsKey) || "{}"); return s && typeof s === "object" ? s : {}; } catch { return {}; } };

{
  const style = document.createElement("style");
  style.textContent = `
    details.tutor-section { border: 1px solid var(--line); border-radius: 10px; background: var(--panel); }
    details.tutor-section > summary { display: flex; align-items: baseline; gap: 8px; padding: 10px 12px; cursor: pointer; list-style: none; color: var(--label); font-size: 13px; font-weight: 500; }
    details.tutor-section > summary::-webkit-details-marker { display: none; }
    details.tutor-section > summary::before { content: "\\25B8"; color: var(--muted); font-size: 11px; }
    details.tutor-section[open] > summary::before { content: "\\25BE"; }
    details.tutor-section > summary .tutor-summary { margin-left: auto; font-size: 12px; font-weight: 400; color: var(--muted); }
    details.tutor-section > .tutor-section-body { padding: 2px 12px 12px; display: flex; flex-direction: column; gap: 10px; overflow-wrap: anywhere; }
    details.tutor-section .tutor-section-body p { margin: 0; color: var(--muted); font-size: 12px; }
    /* A text link of the Tutor panel (the Probe line, "Add what you thought"): docs/agents/ui-style.md */
    #pane-tutor .tutor-link, #probe-offer button { padding: 0; background: none; border: 0; border-radius: 0; font-size: 12px; font-weight: 400; color: var(--accent-soft); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
  `;
  document.head.append(style);
}

// A section with its title; `id` is the key under which the open or closed choice is kept. Returns the element, its body
// (fill it) and `summarise(text)` for the one-line summary on the right.
function tutorSection(id, title) {
  const el = Object.assign(document.createElement("details"), { id: `${id}-card`, className: "tutor-section", hidden: true });
  const summary = Object.assign(document.createElement("span"), { className: "tutor-summary" });
  const head = Object.assign(document.createElement("summary"), { textContent: title });
  const body = Object.assign(document.createElement("div"), { className: "tutor-section-body" });
  head.append(summary);
  el.append(head, body);
  el.open = tutorSectionsRead()[id] === true;
  // A class folds every section on its own; that is not the person's choice and is not remembered.
  el.addEventListener("toggle", () => {
    if ($("pane-tutor").classList.contains("tutor-live")) return;
    try { localStorage.setItem(tutorSectionsKey, JSON.stringify({ ...tutorSectionsRead(), [id]: el.open })); } catch { /* nothing is remembered; the page still works */ }
  });
  return { el, body, summarise: (text) => { summary.textContent = text; } };
}
