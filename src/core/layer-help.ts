// What each of the six diagram layers is, in plain words: one structure per layer, so the Tutor teaches from it and the interface's
// quick tour reads it (GET /layers/help). Per layer: what it is, the guiding question, an example and the order its elements are told in;
// per element: { name, hint, what, question, example, narration }. The Business entries repeat 46-business-help.js (a test keeps them equal).
import { LAYER_CONCEPTS } from "./probe.ts";

type Element = { name: string; hint: string; what: string; question: string; example: string; narration: string };
type LayerHelp = { name: string; what: string; question: string; example: string; order: string[]; elements: Record<string, Element> };

const BUSINESS_ELEMENTS: Record<string, Element> = {
  "customer segments": {
    "name": "Customer Segments",
    "hint": "Who is this for?",
    "what": "The people or organisations you are creating value for.",
    "question": "Who would be sad if you disappeared tomorrow?",
    "example": "Freelance designers who write quotes by hand.",
    "narration": "We start with the people you do this for. Everything else on the canvas exists to serve them."
  },
  "value propositions": {
    "name": "Value Propositions",
    "hint": "What do you give them that they want?",
    "what": "The reason those people would pick you: the problem you solve or the benefit you bring.",
    "question": "What would they miss if you were gone?",
    "example": "A quote tool that takes two minutes instead of two hours.",
    "narration": "Next comes the heart of it: what you offer them. It answers a need of the people in the step before."
  },
  "channels": {
    "name": "Channels",
    "hint": "How do they find you and get it?",
    "what": "The ways people hear about you, try you and receive what you offer.",
    "question": "Where do they first meet you, and how does it reach them?",
    "example": "A website, word of mouth and an app store page.",
    "narration": "Now, how the offer reaches those people: how they discover it and how they get it."
  },
  "customer relationships": {
    "name": "Customer Relationships",
    "hint": "How do you keep them happy?",
    "what": "The kind of contact you keep with customers, from winning them to keeping them.",
    "question": "What do they expect from you after the first day?",
    "example": "A quick reply in the chat and a monthly tips email.",
    "narration": "Reaching them is not enough. This is how you stay in touch so they keep coming back."
  },
  "revenue streams": {
    "name": "Revenue Streams",
    "hint": "How do they pay you?",
    "what": "The ways money comes in from each kind of customer.",
    "question": "What are they willing to pay for, and how?",
    "example": "A monthly subscription plus a one-off setup fee.",
    "narration": "Now the money side: how what you give turns into income from those customers."
  },
  "key resources": {
    "name": "Key Resources",
    "hint": "What do you need to have?",
    "what": "The important things you must own or reach for the rest to work: people, tools, money, know-how.",
    "question": "What could you not work without?",
    "example": "Two developers, a server and your customer list.",
    "narration": "Behind the scenes now. To deliver all of that, these are the things you need to have."
  },
  "key activities": {
    "name": "Key Activities",
    "hint": "What must you do well?",
    "what": "The most important things you have to do, day to day, to deliver your offer.",
    "question": "What has to go right every week?",
    "example": "Building the product, answering support and shipping updates.",
    "narration": "And this is what you must actually do with those resources to make it all happen."
  },
  "key partnerships": {
    "name": "Key Partnerships",
    "hint": "Who helps you?",
    "what": "The other people and companies you rely on, so you do not have to do everything yourself.",
    "question": "Who do you depend on for what you cannot, or would rather not, do?",
    "example": "A payment provider and a hosting company.",
    "narration": "You do not work alone. These are the outsiders who help with the resources and the work."
  },
  "cost structure": {
    "name": "Cost Structure",
    "hint": "What does it cost you?",
    "what": "The main costs of running everything above.",
    "question": "Which costs are the biggest, and which can you not avoid?",
    "example": "Salaries, hosting and payment fees.",
    "narration": "Last, the price tag. Resources, activities and partners all cost something, and this is where it adds up. Compare it with the money coming in."
  }
};
const BUSINESS_ORDER = ["customer segments","value propositions","channels","customer relationships","revenue streams","key resources","key activities","key partnerships","cost structure"];

const REQUIREMENTS_ELEMENTS: Record<string, Element> = {
  "functional requirement": {
    name: "Functional requirement",
    hint: "What must it do?",
    what: "One thing a kind of person must be able to do with the software, told as: as someone, I want something, so that I get a benefit.",
    question: "Who needs this, what do they want to do, and why?",
    example: "As a shopper, I want to save my cart, so that I can finish buying tomorrow.",
    narration: "We start with what the software must do for people. Each one is a small sentence with a person, a wish and a reason.",
  },
  "acceptance criteria": {
    name: "Acceptance criteria",
    hint: "How will you know it works?",
    what: "Short checks, written as given a situation, when something happens, then this result, that say when a requirement is done.",
    question: "What would you try to be sure this really works?",
    example: "Given a cart with two items, when I close the app and open it again, then both items are still there.",
    narration: "A wish is not enough. These checks say how you would prove each one works, so nobody argues later about what done means.",
  },
  "non-functional requirement": {
    name: "Non-functional requirement",
    hint: "How well must it do it?",
    what: "A quality the software must have, such as speed, safety or ease of use, with a number you can measure.",
    question: "How fast, how safe or how easy does it need to be, and how would you measure that?",
    example: "Security: a stolen password alone cannot open an account. Measure: every login asks for a second step.",
    narration: "Last, not what it does but how well. Each quality needs a measure, or nobody can tell if it was met.",
  },
};

const ARCHITECTURE_ELEMENTS: Record<string, Element> = {
  person: {
    name: "Person",
    hint: "Who uses it?",
    what: "A kind of user of the software, drawn outside it.",
    question: "Who uses this, and what do they use it for?",
    example: "Shopper: browses products and pays for an order.",
    narration: "We start with the people around the software, because everything inside exists to serve them.",
  },
  system: {
    name: "Software system",
    hint: "What is the whole thing, and what is outside it?",
    what: "The software you are building as one box, plus other systems it talks to that you do not build.",
    question: "What is yours, and what do you rely on that belongs to someone else?",
    example: "The online shop, and a payment company we call to charge cards.",
    narration: "Next, the whole software as one box, and the outside systems it depends on.",
  },
  container: {
    name: "Container",
    hint: "What parts run on their own?",
    what: "A separately running part of your system, such as a website, a server or a database.",
    question: "Which pieces run on their own and store or serve something?",
    example: "A web app, an API server and a database.",
    narration: "Now we open the box. These are the big parts that run by themselves and the technology each one uses.",
  },
  component: {
    name: "Component",
    hint: "What is inside a part?",
    what: "A group of code inside one container that does one job.",
    question: "What are the main jobs inside this part?",
    example: "Inside the API server: orders, payments and accounts.",
    narration: "Zooming into one part, these are the jobs it is made of.",
  },
  containment: {
    name: "Inside another box",
    hint: "What belongs where?",
    what: "A box drawn inside another one, to say it is a part of it.",
    question: "What is a part of what?",
    example: "The orders component sits inside the API server.",
    narration: "A box inside a box means belonging. It keeps the picture tidy as it grows.",
  },
  relationship: {
    name: "Relationship",
    hint: "Who talks to whom?",
    what: "An arrow from one box to another, with a few words on why they talk and how.",
    question: "Which part asks which for what, and in what way?",
    example: "The web app asks the API server for orders, over HTTPS.",
    narration: "Last, the arrows. Each says who uses whom and what for, so you can see what breaks if one part fails.",
  },
};

const COMPONENTS_ELEMENTS: Record<string, Element> = {
  package: {
    name: "File (module)",
    hint: "Where does the code live?",
    what: "A code file, drawn as a tab that holds the classes and functions written in it.",
    question: "Which file would you open to change this?",
    example: "cart.py holds the Cart class and apply_discount.",
    narration: "This layer is drawn from your real code. The big boxes are the files.",
  },
  class: {
    name: "Class",
    hint: "What things does the code describe?",
    what: "A blueprint for things the program works with, with the data it keeps and the actions it can do.",
    question: "What kind of thing is this, what does it keep and what can it do?",
    example: "Cart keeps items and can add an item or give the total.",
    narration: "Inside the files are classes: each one is a kind of thing with its own data and actions.",
  },
  function: {
    name: "Function",
    hint: "What does one action do?",
    what: "One named action in the code, which takes some values and gives something back.",
    question: "What goes in, and what comes out?",
    example: "apply_discount takes a cart and a code and returns the new total.",
    narration: "Functions are single actions. The Flow layer opens one up step by step.",
  },
  relationship: {
    name: "Relationship",
    hint: "How do the pieces depend on each other?",
    what: "A line saying one piece builds on another: it inherits from it, imports it or calls it.",
    question: "If I change this piece, what else could break?",
    example: "main imports cart and calls Cart.add.",
    narration: "The lines show who depends on whom. The more lines into a piece, the more careful you must be when changing it.",
  },
  certainty: {
    name: "How sure the line is",
    hint: "Is this line certain?",
    what: "Each line is marked as certain, guessed from names, or unknown when the code is too dynamic to tell. aidea never draws a guess as certain.",
    question: "Which lines can I trust, and which should I check in the code?",
    example: "A call written as getattr(obj, name)() cannot be traced, so it is shown as unknown.",
    narration: "Last, the honesty of the picture: some lines are guesses, and they are drawn differently so you know.",
  },
};

const DATA_ELEMENTS: Record<string, Element> = {
  variable: {
    name: "Variable",
    hint: "What does it hold right now?",
    what: "A labelled box with the name of a variable and the value it holds at the step being shown. A value that aidea cannot draw is still a box, with its text.",
    question: "What is in this box, and where did it come from?",
    example: "total is 30.",
    narration: "Each box is one variable of the function, with what it holds at this very step.",
  },
  list: {
    name: "List",
    hint: "What is in it, and in what place?",
    what: "A row of cells, one for each item, with its position above it. Positions start at 0, so the first item is in place 0.",
    question: "Which item is in place 1, and what happens to the row when one is added?",
    example: "items is [10, 20]: 10 in place 0 and 20 in place 1.",
    narration: "A list is a row of cells. The small number above each cell is its place, counted from zero.",
  },
  dictionary: {
    name: "Dictionary",
    hint: "Which key points to which value?",
    what: "Keys, each pointing to the value it stands for. You look a value up by its key, not by a place.",
    question: "What would you look up here, and what would you get back?",
    example: "prices maps apple to 3 and pear to 5.",
    narration: "A dictionary is a set of labels, each pointing to a value. You ask by label.",
  },
  change: {
    name: "What changed",
    hint: "What did the last step change?",
    what: "The variable whose value is different from the step before is highlighted, so you see what the step did without comparing by eye.",
    question: "Which box was highlighted, and which line of the code did that?",
    example: "After the line that adds a price, items is highlighted and has one more cell.",
    narration: "Step by step, the box that changed lights up. That is the effect of the line that just ran.",
  },
  limit: {
    name: "Large values",
    hint: "Why is part of it hidden?",
    what: "A very large list or dictionary shows its first part and then says how many are not shown, as \"9,900 more hidden\", so the drawing stays quick to read.",
    question: "Do you need to see every item to understand what the step did?",
    example: "A list of 10,000 numbers shows the first hundred and says 9,900 more hidden.",
    narration: "Long lists are cut, and the drawing says so, so you always know that something is not shown.",
  },
};

const FLOW_ELEMENTS: Record<string, Element> = {
  "start and end": {
    name: "Start and end",
    hint: "Where does it begin and finish?",
    what: "The rounded shapes that mark where the function starts and where it stops.",
    question: "What triggers this, and what is true when it finishes?",
    example: "Start: the shopper presses Pay. End: the order is saved.",
    narration: "Every flow has one beginning. We follow it from there.",
  },
  step: {
    name: "Step",
    hint: "What happens, in order?",
    what: "A box for one thing the code does, such as calculating a value or saving data.",
    question: "What is done here, and what does it need first?",
    example: "Add up the price of every item in the cart.",
    narration: "Steps are the work itself, one after the other.",
  },
  decision: {
    name: "Decision",
    hint: "Where does it choose?",
    what: "A diamond where the code asks a yes-or-no question and takes one of two ways.",
    question: "What is being checked, and what happens on each answer?",
    example: "Is the cart empty? Yes: show a message. No: go on to payment.",
    narration: "Here the path splits. Every decision is a place where the code can behave in two different ways.",
  },
  loop: {
    name: "Loop",
    hint: "What repeats?",
    what: "A part that goes around again and again, shown by an arrow that comes back to an earlier step.",
    question: "What repeats, and what makes it stop?",
    example: "For each item in the cart, add its price to the total.",
    narration: "The arrow that comes back is a loop. Always ask what makes it stop.",
  },
  "return or error": {
    name: "Return or error",
    hint: "How can it end?",
    what: "The ways the function leaves early: it gives back an answer, or stops with an error.",
    question: "What can go wrong, and what does the caller get then?",
    example: "If the card is refused, stop with a payment error.",
    narration: "The exits. A function can often end in more than one way, and the unhappy ones matter most.",
  },
  "input and output": {
    name: "Input and output",
    hint: "What does it read or send outside?",
    what: "Steps that talk to the world outside the code: files, the network, a database or the screen.",
    question: "Where does this touch something outside the program?",
    example: "Charge the card through the payment company.",
    narration: "Last, the steps that reach outside the code. They can fail for reasons you do not control.",
  },
};

export const LAYER_HELP: Record<string, LayerHelp> = {
  business: {
    name: "Business",
    what: "A one-page picture of why this project exists: who it is for, what it offers and how it sustains itself.",
    question: "Who needs this, what do they get, and how does it pay for itself?",
    example: "A quote tool for freelance designers, paid by a monthly subscription.",
    order: BUSINESS_ORDER,
    elements: BUSINESS_ELEMENTS,
  },
  requirements: {
    name: "Requirements",
    what: "What the software must do, and how well, written so you can check it later.",
    question: "What must it do for people, and how will you know it works?",
    example: "As a shopper, I want to save my cart, so that I can finish buying tomorrow.",
    order: ["functional requirement", "acceptance criteria", "non-functional requirement"],
    elements: REQUIREMENTS_ELEMENTS,
  },
  architecture: {
    name: "Architecture",
    what: "The big parts of the software, what each is made of and how they talk to each other.",
    question: "What are the main parts, and what depends on what?",
    example: "A web app and an API server that share one database.",
    order: ["person", "system", "container", "component", "containment", "relationship"],
    elements: ARCHITECTURE_ELEMENTS,
  },
  components: {
    name: "Components",
    what: "The real files, classes and functions in the code, and how they depend on each other. It is drawn from the code, never written by hand.",
    question: "Where does each thing live in the code, and what depends on it?",
    example: "cart.py holds the Cart class, and main.py uses it.",
    order: ["package", "class", "function", "relationship", "certainty"],
    elements: COMPONENTS_ELEMENTS,
  },
  flow: {
    name: "Flow",
    what: "The path through one function, step by step: what happens, where it chooses and where it repeats. It is drawn from the code, never written by hand.",
    question: "What does this function do, in what order, and what can make it go another way?",
    example: "Pay: check the cart, charge the card, save the order.",
    order: ["start and end", "step", "decision", "loop", "return or error", "input and output"],
    elements: FLOW_ELEMENTS,
  },
  data: {
    name: "Data",
    what: "The values of one function while it runs: each variable as a box, a list as a row of cells with their places, a dictionary as keys pointing to values. It is drawn from the code by Playback and follows the step being shown. Nobody writes it.",
    question: "What does each variable hold right now, and what did the last step change?",
    example: "total is 30, and items is a row of two cells: 10 in place 0, 20 in place 1.",
    order: ["variable", "list", "dictionary", "change", "limit"],
    elements: DATA_ELEMENTS,
  },
};

// Layers whose content the person writes (the Tutor co-authors it with propose_node); the others are drawn from the code.
const AUTHORED = ["business", "requirements", "architecture"];

// The first message of a layer class: the layer's content as data, and the order of work.
// A live run showed that a Teacher told to work the Plan first never got round to co-authoring, so for the layers the person writes the first
// thing it must do is ask the first element question; the Plan only gets a short note.
const tag = (layer: string, id: string) => `${layer}:${id.replaceAll(" ", "-")}`;
export function layerClassMessage(layer: string): string {
  const help = LAYER_HELP[layer];
  const concepts = LAYER_CONCEPTS[layer] ?? [];
  const content = `The layer's teaching content, as data, in the order to tell it:\n${JSON.stringify({ ...help, elements: help.order.map((id) => ({ id, tag: tag(layer, id), ...help.elements[id] })) })}\n`;
  const plain = "Use plain words, and the content above as your guide; its examples are generic, so look at the person's own project with the read tools and use that.\n";
  if (!AUTHORED.includes(layer)) {
    return (
      `The person opened a class on the ${layer} layer ("Teach me through it"). ${content}` +
      `Plan: call get_plan first. If the Plan has no concepts for the ${layer} layer, add them with set_plan (the layer's usual concepts are ${JSON.stringify(concepts)}), keeping the rest of the Plan. Teach only items of the Plan, with begin_step {item}.\n` +
      plain + "This layer is drawn from the code, so nobody writes it and you make no proposals: teach how to read it, using the person's own project. Begin."
    );
  }
  const first = help.order[0];
  return (
    `The person opened a class on the ${layer} layer ("Teach me through it"). This is a co-authoring class, not a lecture: you help them write the layer in their own words. ${content}${plain}` +
    `Your FIRST question to the person is about the first element, "${first}": ask it with ask {kind: "text", element: "${tag(layer, first)}", prompt} in plain words, with no jargon and no explanation before it (no begin_step, no stepId). They speak first.\n` +
    "Then turn what they said into propose_node or propose_change for that element, quoting their words in rationale.why. Only after that offer alternatives, as one more ask with the same element, starting \"Other ways to see this\". " +
    "Go on to the next element in the order given, with the tag of each element from the content. If they are stuck on a word, explain it briefly (explain needs an open step: begin_step then predict first) and go back to the question.\n" +
    `Plan: call get_plan once. If it has nothing for the ${layer} layer, add at most two concepts with set_plan (usual: ${JSON.stringify(concepts)}), keeping the rest. The Plan only matters for the short explanations above. Begin with your first question.`
  );
}
