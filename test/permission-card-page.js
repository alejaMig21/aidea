// Runs inside the real page (injected by permission-card-page.test.ts): permission cards at narrow chat widths. The card is built like the one in 30-chat.js, in a copy of the chat log of a given width.
const report = { errors: [], cases: [] };
window.addEventListener("error", (e) => { if (!String(e.message).startsWith("ResizeObserver")) report.errors.push(String(e.message)); });
const pcCard = (tool, body) => {
  const box = Object.assign(document.createElement("div"), { className: "permission" });
  const title = Object.assign(document.createElement("strong"), { textContent: `Claude wants to use ${tool}` });
  const pre = Object.assign(document.createElement("pre"), { textContent: body });
  const row = Object.assign(document.createElement("div"), { className: "row" });
  const reason = Object.assign(document.createElement("input"), { placeholder: "Reason for rejecting (optional)" });
  const approve = Object.assign(document.createElement("button"), { textContent: "Approve" });
  const reject = Object.assign(document.createElement("button"), { textContent: "Reject", className: "reject" });
  row.append(approve, reject, reason);
  box.append(title, pre, row);
  return box;
};
(async () => {
  try {
    const tools = ["Bash", "mcp__plugin_engram_engram__mem_search", "mcp__plugin_some_very_long_plugin_name__a_tool_whose_name_has_no_spaces_at_all_and_keeps_going"];
    for (const width of [240, 270, 340, 510]) {
      for (const tool of tools) {
        const log = document.createElement("div");
        log.setAttribute("id", "chat-log"); // the card's rules are written for #chat-log
        log.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:600px;display:flex;`;
        log.append(pcCard(tool, JSON.stringify({ query: "x".repeat(150), limit: 3 }, null, 2)));
        document.body.append(log);
        const r = log.getBoundingClientRect();
        const buttons = [...log.querySelectorAll("button")].map((b) => b.getBoundingClientRect());
        report.cases.push({ width, tool: tool.length, scrolls: log.scrollWidth > log.clientWidth, buttonsInside: buttons.every((b) => b.left >= r.left && b.right <= r.right) });
        log.remove();
      }
    }
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "pc-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
