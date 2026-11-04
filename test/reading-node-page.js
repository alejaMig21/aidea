// Runs inside the real page (injected by reading-node-page.test.ts) and writes what it saw as JSON into a pre element.
const report = { errors: [] };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const rnWait = (ms) => new Promise((r) => setTimeout(r, ms));
const rnUntil = async (cond, ms = 8000) => { for (let t = 0; t < ms; t += 20) { if (await cond()) return true; await rnWait(20); } return false; };
// What carries the sign on the Canvas: the rectangles with the class "reading" (by the id of the Node they draw) and the tags that say so.
const rnSigns = () => ({ rects: [...document.querySelectorAll("#world .reading[data-id]")].map((n) => n.getAttribute("data-id")), tags: [...document.querySelectorAll("#world .reading-tag")].map((n) => n.textContent) });
const rnNode = (kind, file) => algoNodes.find((n) => n.kind === kind && n.file === file);
const rnClass = () => algoNodes.find((n) => n.kind === "class" && n.file === "cart.py");
(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await rnUntil(() => $("home").hidden && $("opening").hidden);
    await rnUntil(() => algoNodes.length > 0 && document.querySelector("#world [data-id]"));
    await rnWait(500);
    report.start = rnSigns();
    const cartModule = rnNode("module", "cart.py"), mainModule = rnNode("module", "main.py"), cartClass = rnClass();
    report.nodes = { cartModule: cartModule?.id, mainModule: mainModule?.id, cartClass: cartClass?.id };

    // Choosing a file that is a Node (a module) selects it and gives it the sign.
    await codeOpenFile("cart.py");
    await rnUntil(() => rnSigns().rects.length > 0);
    report.fileIsNode = { signs: rnSigns(), selected: codeSelected, details: document.querySelector("#panel .code-pick")?.textContent ?? "" };

    // Choosing a Node (a class of that file) moves the sign to it: one Node at a time.
    await codeOpen(cartClass.id);
    await rnUntil(() => rnSigns().rects.includes(cartClass.id));
    report.nodeChosen = { signs: rnSigns() };

    // Another file moves it again.
    await codeOpenFile("main.py");
    await rnUntil(() => rnSigns().rects.includes(mainModule.id));
    report.otherFile = { signs: rnSigns() };

    // A file that is not a Node on the Canvas takes the sign away.
    await codeOpenFile("README-not-a-node.md");
    await rnWait(300);
    report.notANode = { signs: rnSigns() };

    // The sign follows the code that is being read: back to a Node, then to another layer where that Node is not drawn, then back.
    await codeOpenFile("cart.py");
    await rnUntil(() => rnSigns().rects.length > 0);
    document.querySelector('#layers button[data-layer="business"]').click();
    await rnUntil(() => !document.querySelector("#world [data-id]") || rnSigns().rects.length === 0);
    await rnWait(300);
    report.otherLayer = { signs: rnSigns() };
    document.querySelector('#layers button[data-layer="components"]').click();
    await rnUntil(() => rnSigns().rects.length > 0);
    report.backOnComponents = { signs: rnSigns() };

    // The sign is readable without colour: a word and a thicker line, not only a hue.
    const rect = document.querySelector("#world .reading[data-id]");
    const style = getComputedStyle(rect);
    report.look = { strokeWidth: parseFloat(style.strokeWidth), tag: document.querySelector("#world .reading-tag")?.textContent, tagSize: parseFloat(getComputedStyle(document.querySelector("#world .reading-tag")).fontSize) };

    // Selecting a Node on the Canvas: with the Code panel hidden it only offers "View code"; with the panel on screen its code is shown at once.
    const togglePanel = async (title) => { document.getElementById("panels-button").click(); document.querySelector(`#panels-menu [data-title="${title}"]`).click(); document.getElementById("panels-button").click(); await rnWait(400); };
    if (layoutShown.code) await togglePanel("Code"); // the files chosen above opened it: hide it
    report.hiddenNow = !layoutShown.code;
    const tabsBefore = codeTabs.length, activeBefore = codeActive?.focus?.node ?? null;
    onSelect(cartClass.id);
    await rnWait(400);
    report.selectHidden = { opened: codeTabs.length !== tabsBefore || (codeActive?.focus?.node ?? null) !== activeBefore, viewButton: !!document.querySelector("#panel button"), stillHidden: !layoutShown.code };
    await togglePanel("Code");
    report.shownNow = !!layoutShown.code;
    codeSelected = null;
    onSelect(cartClass.id);
    await rnUntil(() => codeActive?.focus?.node === cartClass.id);
    report.selectShown = { opened: codeActive?.focus?.node === cartClass.id, signs: rnSigns() };
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "rn-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
