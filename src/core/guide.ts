// What aidea itself is, in plain words: the one place the "How aidea works" button reads from. The Tutor teaches from it (a class opened with
// {guide: true}) and the interface's quick tour reads it (GET /guide). Same shape as a layer's teaching content (layer-help.ts), plus `tryIt`:
// one small thing to do in the real interface. Every name in double quotes is a label or word the interface really shows (a test checks it),
// so when a button is renamed or a part of the app changes, this file is the only place to update.
type Part = { name: string; hint: string; what: string; question: string; example: string; narration: string; tryIt: string };

const PARTS: Record<string, Part> = {
  "first look": {
    name: "The first look",
    hint: "What am I looking at?",
    what: `The window has three panels side by side: the "Builder" on the left, where you talk to Claude Code; the "Canvas" in the middle, where your project is drawn as layers; and the "Tutor" on the right, which teaches you. In the top bar, the project name opens your recent projects, "Open folder..." and "Home". The buttons at the right of the top bar show or hide the panels; in a wide window you can hide the "Canvas" too, and in a narrow one the Builder and the right panel open over it.`,
    question: "Which of the three would you look at first, and why?",
    example: "Hide the Builder and the right panel to give the drawing the whole window, then bring them back.",
    narration: "Let's start with what is on your screen right now.",
    tryIt: `Press the buttons at the right of the top bar one by one, for example "Show or hide the Canvas", and see which panel comes and goes. Press each one again to bring it back.`,
  },
  builder: {
    name: "The Builder",
    hint: "Where do I ask for things?",
    what: `The "Builder" is a chat with Claude Code, which reads and changes your project. You write under "Ask the builder" and press "Send". When it needs your permission for something, a card asks you to "Approve" or "Reject" it. Two menus under the box choose the model and the permission mode, which decides how much it may do without asking.`,
    question: "What would you ask for first if you were starting a project today?",
    example: "Ask it to explain what a file does, or to add a small feature.",
    narration: "The Builder panel is where the work gets done. You talk to the builder as you would to a colleague.",
    tryIt: `Write a small question under "Ask the builder", for example what the project does, and press "Send".`,
  },
  canvas: {
    name: "The Canvas and its layers",
    hint: "How is my project drawn?",
    what: `The "Canvas" draws your project as layers, and the tabs on top switch between them: "Business", "Requirements", "Architecture" and "Components". The first three are written by you, the Tutor or the builder. "Components" is drawn from your real code, so it can never disagree with it. Double-click a box to see what realises it on the layer below, and press "Zoom out" to come back. The round question-mark button explains what the shapes and colours of the layer mean, and "Fit" shows the whole drawing. On a big project "Components" starts as an overview, with a block per folder and a box per module; double-click a module to open it, and "All modules" brings you back.`,
    question: "Which layer would you open to see what the software must do for people?",
    example: "Open the layer for what the software must do, then the one drawn from the code, and compare how they look.",
    narration: "The Canvas panel shows the project from the idea down to the code, one layer at a time.",
    tryIt: `Press the "Requirements" tab, then the round question-mark button, and read what the layer shows.`,
  },
  proposals: {
    name: "Proposals",
    hint: "How do changes get in?",
    what: `When the builder or the Tutor wants to change a written layer, it makes a Proposal. A Proposal is drawn with a dashed outline on the Canvas, the chat shows a line with a "Review" button, and nothing is saved until you press "Accept" in the right panel; "Reject" throws it away. If the builder suggests something that is already there, or already waiting, the chat says so, and for a waiting one it has an "Open it" button.`,
    question: "Why might you want to read a change before accepting it?",
    example: "The builder suggests a requirement you did not ask for; you reject it and nothing changes.",
    narration: "Nothing reaches your written layers without your say. Every change arrives as a Proposal first.",
    tryIt: `Ask the builder to add a requirement, for example that a shopper can save a cart, and when its Proposal line appears press "Review".`,
  },
  modes: {
    name: "Direct and Class",
    hint: "Do I want to be asked first?",
    what: `Under the chat box, "Builder works" has two settings. "Direct" lets the builder work freely, and you review its Proposals. "Class" makes the builder wait at a big decision until the Tutor has asked you about it. A Proposal that is waiting for a class shows "Start the class", and also "Decide for me" if you would rather skip it; then the builder's own version can be accepted as it is. If you keep missing the questions of a class on a decision, the Tutor offers "Decide for me" too.`,
    question: "When would you rather be asked first, and when would you rather just see the result?",
    example: "Direct while you try ideas quickly, Class while you decide something you want to understand.",
    narration: "You choose how much the Tutor gets in the way of the builder.",
    tryIt: `Point at "Direct" and then at "Class" under the chat box, and read the short help each one shows.`,
  },
  tutor: {
    name: "The Tutor",
    hint: "How do I learn here?",
    what: `The "Tutor" panel is where you learn why things are the way they are. "Start a class" begins a class on a topic you type, or on something the Tutor picks from your project. A class goes in small steps: it asks you to guess first, then explains, then checks what you understood. Each layer also has a "Teach me through it" button, which starts a class on that layer. Select any text on screen to get "Just define" for a short explanation, or "Enter the Tutor" for a class on it. The Tutor never changes your code; it can only suggest changes to the written layers, as Proposals.`,
    question: "What is something in your project you could not explain to a friend yet?",
    example: "Type queues as a topic and press Start a class.",
    narration: "The Tutor panel is the part of aidea that cares whether you understand what gets built.",
    tryIt: `Open the "Tutor" panel and press "Start a class", or press "Teach me through it" on the layer you have open.`,
  },
  plan: {
    name: "The Plan",
    hint: "What should I understand?",
    what: `The Tutor makes a Plan for your project in your first class, and a "Plan" section then appears in the Tutor panel. It lists what you need to understand for this project, in the order the ideas depend on each other, plus the decisions still open on each layer, and a check mark shows what you have already covered. The Tutor asks questions only about what is in it. You cannot edit it by hand: ask the Tutor to change it.`,
    question: "Which idea do you need before the next one makes sense?",
    example: "A queue comes before a worker, because a worker takes its jobs from the queue.",
    narration: "Learning has an order, and the Plan keeps it for you.",
    tryIt: `If the Tutor panel already has a "Plan" section, open it and read its first line; if not, it will appear after your first class.`,
  },
  contract: {
    name: "The Contract",
    hint: "What did I agree?",
    what: `The "Contract" section is a checklist of what you have agreed on the Business, Requirements and Architecture layers, and it shows how many checks are met. The builder reads it before building, and may only depart from it through a Proposal you accept.`,
    question: "What have you decided so far that the builder must respect?",
    example: "You accepted a requirement; from then on the builder builds towards it.",
    narration: "What you accept becomes the agreement the builder works to.",
    tryIt: `Open the "Contract" section in the Tutor panel and see which checks are met.`,
  },
  differences: {
    name: "Differences",
    hint: "Does the code match what I agreed?",
    what: `The "Differences" section lists where your code is not what you agreed. It only informs: nothing is blocked, and either side may be the one to change. "Show on" a layer marks the places, and "Ask me about it" starts a class on that difference.`,
    question: "If the code and the agreement disagree, which one should change?",
    example: "The code does something no requirement asks for; you add the requirement or remove the code.",
    narration: "Plans and code drift apart. This is where aidea tells you.",
    tryIt: `Open the "Differences" section in the Tutor panel and read what it says.`,
  },
  playback: {
    name: "Playback",
    hint: "Can I watch the code run?",
    what: `On "Components", double-click a function to open its flowchart. The "Run" panel then opens as its own panel next to the Canvas and lets you fill in "Test data" and press "Record a run", which runs that function for real on your computer. "Play" and the step arrows then replay what happened, one step at a time, without running it again. A short sentence under the flowchart tells in plain words what happened at each step. If you tick "Guess first", you are asked to predict the next step before it is shown.`,
    question: "Where does this function take another way, and what value decides it?",
    example: "Watch which branch a discount check takes for a cart of two items.",
    narration: "Last, you can watch a real run of the code, one step at a time.",
    tryIt: `Double-click a function on "Components", open the "Run" panel and look at "Test data". Press "Record a run" only for code you trust.`,
  },
};

export const GUIDE = {
  name: "How aidea works",
  what: "aidea is a workspace where you build software with an AI builder on a drawing of layers, from the idea down to the code, while a Tutor makes sure you understand each decision.",
  question: "What do you want to be able to do with aidea after this tour?",
  example: "Describe a project, let the builder propose its requirements, accept the ones you agree with and learn the reasons behind them.",
  order: ["first look", "builder", "canvas", "proposals", "modes", "tutor", "plan", "contract", "differences", "playback"],
  elements: PARTS,
};

// The first message of the guide class: the content as data, and the order of work.
export function guideClassMessage(): string {
  const content = JSON.stringify({ ...GUIDE, elements: GUIDE.order.map((id) => ({ id, ...PARTS[id] })) });
  return (
    `The person pressed "How aidea works": a class about aidea itself, not about their project. The content below is everything true you may say about the app, as data, in the order to tell it:\n${content}\n` +
    "This is not a lecture. Your FIRST step starts from what the person sees on the screen right now: begin_step {stepId, title} for the first part (\"first look\"), then predict {stepId, prompt} asking them what each panel is for, before you explain anything.\n" +
    "Then, for each part in the order given: begin_step, predict, explain, and ask them to do the part's tryIt in the real interface, then check with ask what they saw. Explain in your own plain words, short, and only what the content says: do not invent buttons, settings or features, and if they ask about something the content does not cover, say you do not know.\n" +
    "This class is about the app, so leave the Plan alone: do not call get_plan or set_plan and do not give begin_step an item. You make no proposals. Begin."
  );
}
