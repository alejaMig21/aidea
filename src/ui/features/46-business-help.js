// Business layer, explained: every sentence a newcomer reads lives in BUSINESS_HELP below (one entry per block id), so it can be
// edited or translated in one place and another layer can copy the pattern: { id: { hint, what, question, example, narration, yours } }.
//   hint       one short question under the block's name (shown larger, as a prompt, while the block is empty)
//   what       one sentence: what the block is            question  the guiding question (hover/focus card)
//   example    one generic example, shown marked "Example"  narration  how the guided reading says this block follows the previous one
//   yours      lead-in used when the block has notes: "<yours>: <the person's own notes>"
// Loaded before 46-business.js, which draws the hints and calls businessHelpDrawn() after each drawing.
const BUSINESS_HELP = {
  "customer segments": {
    hint: "Who is this for?",
    what: "The people or organisations you are creating value for.",
    question: "Who would be sad if you disappeared tomorrow?",
    example: "Freelance designers who write quotes by hand.",
    narration: "We start with the people you do this for. Everything else on the canvas exists to serve them.",
    yours: "You said your customers are",
  },
  "value propositions": {
    hint: "What do you give them that they want?",
    what: "The reason those people would pick you: the problem you solve or the benefit you bring.",
    question: "What would they miss if you were gone?",
    example: "A quote tool that takes two minutes instead of two hours.",
    narration: "Next comes the heart of it: what you offer them. It answers a need of the people in the step before.",
    yours: "You said you offer",
  },
  channels: {
    hint: "How do they find you and get it?",
    what: "The ways people hear about you, try you and receive what you offer.",
    question: "Where do they first meet you, and how does it reach them?",
    example: "A website, word of mouth and an app store page.",
    narration: "Now, how the offer reaches those people: how they discover it and how they get it.",
    yours: "You said people reach you through",
  },
  "customer relationships": {
    hint: "How do you keep them happy?",
    what: "The kind of contact you keep with customers, from winning them to keeping them.",
    question: "What do they expect from you after the first day?",
    example: "A quick reply in the chat and a monthly tips email.",
    narration: "Reaching them is not enough. This is how you stay in touch so they keep coming back.",
    yours: "You said you keep customers happy by",
  },
  "revenue streams": {
    hint: "How do they pay you?",
    what: "The ways money comes in from each kind of customer.",
    question: "What are they willing to pay for, and how?",
    example: "A monthly subscription plus a one-off setup fee.",
    narration: "Now the money side: how what you give turns into income from those customers.",
    yours: "You said money comes in from",
  },
  "key resources": {
    hint: "What do you need to have?",
    what: "The important things you must own or reach for the rest to work: people, tools, money, know-how.",
    question: "What could you not work without?",
    example: "Two developers, a server and your customer list.",
    narration: "Behind the scenes now. To deliver all of that, these are the things you need to have.",
    yours: "You said you need",
  },
  "key activities": {
    hint: "What must you do well?",
    what: "The most important things you have to do, day to day, to deliver your offer.",
    question: "What has to go right every week?",
    example: "Building the product, answering support and shipping updates.",
    narration: "And this is what you must actually do with those resources to make it all happen.",
    yours: "You said you must do",
  },
  "key partnerships": {
    hint: "Who helps you?",
    what: "The other people and companies you rely on, so you do not have to do everything yourself.",
    question: "Who do you depend on for what you cannot, or would rather not, do?",
    example: "A payment provider and a hosting company.",
    narration: "You do not work alone. These are the outsiders who help with the resources and the work.",
    yours: "You said you are helped by",
  },
  "cost structure": {
    hint: "What does it cost you?",
    what: "The main costs of running everything above.",
    question: "Which costs are the biggest, and which can you not avoid?",
    example: "Salaries, hosting and payment fees.",
    narration: "Last, the price tag. Resources, activities and partners all cost something, and this is where it adds up. Compare it with the money coming in.",
    yours: "You said it costs you",
  },
};
// The order the canvas is usually told in (the numbers on the blocks follow the core's order, not this one).
const BUSINESS_WALK = ["customer segments", "value propositions", "channels", "customer relationships", "revenue streams", "key resources", "key activities", "key partnerships", "cost structure"];
let businessHeld = {}; // block id -> titles of the person's own notes, set by drawBusiness

{
  const style = document.createElement("style");
  style.textContent = `
    .bhint { fill: var(--muted); font: 11px var(--sans); pointer-events: none; }
    .bprompt { fill: var(--label); font: 15px var(--sans); pointer-events: none; }
    #business-card { position: absolute; z-index: 4; width: 260px; padding: 10px 12px; background: var(--raised); border: 1px solid var(--control); border-radius: 10px; box-shadow: 0 10px 28px #0009; font-size: 12.5px; line-height: 1.45; color: var(--label); pointer-events: none; }
    #business-card h3 { margin: 0 0 4px; font: 600 12.5px var(--sans); color: var(--authored); }
    #business-card p { margin: 0 0 6px; } #business-card p:last-child { margin: 0; color: var(--muted); }
    #business-card b { color: var(--text); font-weight: 600; }
    #business-walk { position: absolute; left: 15px; right: 15px; z-index: 3; padding: 10px 12px; background: var(--panel); border: 1px solid var(--accent); border-radius: 10px; box-shadow: 0 10px 28px #0009; }
    #business-walk .step { margin: 0 0 4px; font: 600 10.5px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
    #business-walk .say { margin: 0 0 8px; font-size: 13.5px; line-height: 1.5; color: var(--text); }
    #business-walk .row { display: flex; gap: 6px; }
    #business-walk .row button { padding: 4px 12px; font-size: 13px; background: transparent; color: var(--text); border: 1px solid var(--control); }
    #business-walk .row button.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
    #business-walk .row .close { margin-left: auto; }
    #business-walk-open { position: absolute; left: 15px; top: 58px; z-index: 2; padding: 4px 12px; border-radius: 8px; border: 1px solid var(--control); background: var(--panel); color: var(--text); font-size: 13px; } /* under the layer bar, so no tab is pushed out of view */
    .bwalk-on :is(.bblock, .bnote) { transition: opacity .25s ease; }
    .bwalk-on :is(.bblock, .bnote):not(.bwalk-now) { opacity: .2; }
    .bwalk-on .bblock.bwalk-now > rect { stroke: var(--accent); stroke-width: 2.5; }
    @media (prefers-reduced-motion: reduce) { .bwalk-on :is(.bblock, .bnote) { transition: none; } }
    body.motion-off .bwalk-on :is(.bblock, .bnote) { transition: none; }
  `;
  document.head.append(style);
}

const businessName = (id) => (typeof BUSINESS_BLOCKS === "object" && BUSINESS_BLOCKS[id]) || id;
const businessBlockEl = (id) => authoredGroup.querySelector(`g[data-layer="business"] .bblock[data-id="${id}"]`);

// ---- Hover and focus card: placed outside the block (below, else above, else beside) and kept inside the canvas.
const businessCard = Object.assign(document.createElement("div"), { id: "business-card", hidden: true, role: "tooltip" });
document.querySelector("main").append(businessCard);
let businessCardFor = null;

function businessHideCard() {
  businessCard.hidden = true;
  businessCardFor?.removeAttribute("aria-describedby");
  businessCardFor = null;
}
function businessShowCard(blockEl) {
  const id = blockEl.dataset.id, help = BUSINESS_HELP[id];
  if (!help || businessWalkOpen) return businessHideCard();
  if (businessCardFor !== blockEl) businessHideCard();
  businessCardFor = blockEl;
  const bold = (label, text) => { const p = document.createElement("p"), b = document.createElement("b"); b.textContent = `${label} `; p.append(b, text); return p; };
  const title = Object.assign(document.createElement("h3"), { textContent: businessName(id) });
  businessCard.replaceChildren(title, Object.assign(document.createElement("p"), { textContent: help.what }), bold("Ask yourself:", help.question), bold("Example:", help.example));
  businessCard.style.visibility = "hidden";
  businessCard.hidden = false;
  const main = document.querySelector("main").getBoundingClientRect(), b = blockEl.querySelector("rect").getBoundingClientRect();
  const w = businessCard.offsetWidth, h = businessCard.offsetHeight, gap = 8;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  const x = clamp(b.left - main.left, 8, main.width - w - 8);
  const spots = [[x, b.bottom - main.top + gap], [x, b.top - main.top - h - gap], [b.right - main.left + gap, clamp(b.top - main.top, 8, main.height - h - 8)], [b.left - main.left - w - gap, clamp(b.top - main.top, 8, main.height - h - 8)]];
  const fits = ([px, py]) => px >= 8 && py >= 8 && px + w <= main.width - 8 && py + h <= main.height - 8;
  const [px, py] = spots.find(fits) ?? [x, clamp(b.bottom - main.top + gap, 8, main.height - h - 8)];
  Object.assign(businessCard.style, { left: `${px}px`, top: `${py}px`, visibility: "" });
  blockEl.setAttribute("aria-describedby", "business-card");
}
const businessBlockOf = (target) => {
  const hit = target.closest?.(".bblock, .bnote[data-block]");
  return hit && businessBlockEl(hit.dataset.id ?? hit.dataset.block);
};
svg.addEventListener("pointerover", (e) => { const b = businessBlockOf(e.target); if (b) businessShowCard(b); else businessHideCard(); });
svg.addEventListener("pointerleave", businessHideCard);
svg.addEventListener("pointerdown", businessHideCard);
svg.addEventListener("wheel", businessHideCard, { passive: true });
svg.addEventListener("focusin", (e) => { const b = businessBlockOf(e.target); if (b) businessShowCard(b); });
svg.addEventListener("focusout", businessHideCard);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !businessCard.hidden) businessHideCard(); });

// ---- "Teach me through it": the blocks one at a time, the others dim; user-stepped, never starts by itself.
let businessWalkOpen = false, businessStep = 0;
const businessWalkOpener = Object.assign(document.createElement("button"), { type: "button", id: "business-walk-open", textContent: "Teach me through it", hidden: true, title: "A guided class on the nine blocks, one at a time (a quick tour until the Tutor is available)" });
document.querySelector("main").append(businessWalkOpener);
const businessWalk = Object.assign(document.createElement("div"), { id: "business-walk", hidden: true, role: "region" });
businessWalk.setAttribute("aria-label", "Guided reading of the canvas");
const walkStep = Object.assign(document.createElement("p"), { className: "step" });
const walkSay = Object.assign(document.createElement("p"), { className: "say" });
walkSay.setAttribute("aria-live", "polite");
const walkButton = (label, className = "") => Object.assign(document.createElement("button"), { type: "button", textContent: label, className });
const walkBack = walkButton("Back"), walkNext = walkButton("Next", "primary"), walkClose = walkButton("Close", "close");
walkClose.setAttribute("aria-label", "Close the guided reading");
const walkRow = Object.assign(document.createElement("div"), { className: "row" });
walkRow.append(walkBack, walkNext, walkClose);
businessWalk.append(walkStep, walkSay, walkRow);
document.querySelector("main").append(businessWalk);

function businessNarration(id) {
  const help = BUSINESS_HELP[id], own = businessHeld[id] ?? [];
  if (!own.length) return help.narration;
  const shown = own.slice(0, 4).join(", ") + (own.length > 4 ? ` and ${own.length - 4} more` : "");
  return `${help.yours}: ${shown}. ${help.narration}`;
}
function businessWalkApply() {
  const layer = authoredGroup.querySelector('g[data-layer="business"]');
  if (!layer) return;
  layer.classList.toggle("bwalk-on", businessWalkOpen);
  layer.querySelectorAll(".bwalk-now").forEach((n) => n.classList.remove("bwalk-now"));
  if (!businessWalkOpen) return;
  const id = BUSINESS_WALK[businessStep];
  layer.querySelectorAll(`.bblock[data-id="${id}"], .bnote[data-block="${id}"]`).forEach((n) => n.classList.add("bwalk-now"));
}
function businessWalkRender() {
  const id = BUSINESS_WALK[businessStep];
  walkStep.textContent = `Step ${businessStep + 1} of ${BUSINESS_WALK.length}: ${businessName(id)}`;
  walkSay.textContent = businessNarration(id);
  walkBack.disabled = businessStep === 0;
  walkNext.textContent = businessStep === BUSINESS_WALK.length - 1 ? "Finish" : "Next";
  if (document.activeElement === walkBack && walkBack.disabled) walkNext.focus();
  businessWalkApply();
}
function businessWalkSet(open) {
  if (open && !businessBlockEl(BUSINESS_WALK[0])) return;
  businessWalkOpen = open;
  businessWalk.hidden = !open;
  if (open) {
    businessHideCard();
    businessStep = 0;
    const credit = $("business-credit");
    businessWalk.style.bottom = `${63 + (credit?.offsetHeight ?? 0) + 8}px`;
    businessWalkRender();
    walkNext.focus();
  } else {
    businessWalkApply();
    if (businessWalk.contains(document.activeElement) || document.activeElement === document.body) businessWalkOpener.focus();
  }
}
businessWalkOpener.onclick = () => businessWalkSet(true);
walkBack.onclick = () => { businessStep = Math.max(0, businessStep - 1); businessWalkRender(); };
walkNext.onclick = () => { if (businessStep === BUSINESS_WALK.length - 1) businessWalkSet(false); else { businessStep++; businessWalkRender(); } };
walkClose.onclick = () => businessWalkSet(false);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && businessWalkOpen && legendPop.hidden) businessWalkSet(false); });

// drawBusiness calls this after each drawing: a redraw during a walk keeps the highlight and the narration current.
function businessHelpDrawn() {
  if (businessWalkOpen) businessWalkRender();
}

// The opener belongs to the Business layer; leaving the layer ends the walk and the card. (It is a plain button in a toggle row.)
const showLayerWithoutHelp = showLayer;
showLayer = (which) => {
  if (which !== "business") { businessWalkOpen = false; businessWalk.hidden = true; businessHideCard(); }
  showLayerWithoutHelp(which);
  businessWalkApply();
  businessWalkOpener.hidden = which !== "business";
  businessWalkOpener.removeAttribute("aria-pressed"); // showLayer sets it on every button of the bar
};
