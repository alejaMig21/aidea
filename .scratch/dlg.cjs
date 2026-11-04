const fs = require("fs");
function edit(file, pairs) {
  let t = fs.readFileSync(file, "utf8");
  const eol = t.includes("\r\n") ? "\r\n" : "\n";
  for (const [a, b] of pairs) {
    const A = a.replace(/\n/g, eol), B = b.replace(/\n/g, eol);
    if (!t.includes(A)) throw new Error("nf " + file + ": " + a.slice(0, 70));
    t = t.replace(A, () => B);
  }
  fs.writeFileSync(file, t);
}
edit("src/ui/features/01-dialog.js", [
  [`{
  const style = document.createElement("style");`, `let dialogConfirm; // assigned below: the block keeps the helper names out of the shared global scope
{
  const style = document.createElement("style");`],
  [`  function dialogConfirm({ title, message, lines = [], accept = "OK", cancel = "Cancel" }) {`, `  dialogConfirm = function ({ title, message, lines = [], accept = "OK", cancel = "Cancel" }) {`],
  [`      no.focus();
    });
  }
}`, `      no.focus();
    });
  };
}`],
]);
edit("src/ui/features/02-plugins.js", [
  [`    project: () => (typeof current === "undefined" ? null : current),`, `    project: () => (typeof current === "undefined" ? null : current),
    // A question that needs a yes or a no, in the dialog of aidea (never the browser's): ui.confirm({ title, message?, lines?, accept?, cancel? }) resolves true or false.
    confirm: (options) => dialogConfirm(options),`],
]);
edit("src/plugins/run/ui.js", [
  [`            const shown = r.whole ? r.whole.parts.map((p) => \`\${p.name}: \${p.command}\`).join("\n") : \`Added: \${r.changes.added.join(", ") || "none"}. Removed: \${r.changes.removed.join(", ") || "none"}. Changed: \${r.changes.changed.join(", ") || "none"}.\`;
            if (window.confirm(\`\${r.whole ? "This project wants to run these commands on your machine:" : "The run recipe changed since you accepted it:"}\n\n\${shown}\n\nAccept and start?\`)) {`, `            const lines = r.whole ? r.whole.parts.map((p) => \`\${p.name}: \${p.command}\`) : [\`Added: \${r.changes.added.join(", ") || "none"}\`, \`Removed: \${r.changes.removed.join(", ") || "none"}\`, \`Changed: \${r.changes.changed.join(", ") || "none"}\`];
            const yes = await ui.confirm({
              title: r.whole ? "This project wants to run these commands on your machine" : "The run recipe changed since you accepted it",
              message: r.whole ? "Read them before you accept. They run with your own permissions." : "Only what changed is shown. Accepting lets the whole recipe run again.",
              lines, accept: "Accept and start", cancel: "Cancel",
            });
            if (yes) {`],
]);
