// A plugin asked to download a program (language-plugins 07): aidea asks the person, in its own dialog, what the file is, where it comes from and how big it is. The text is written here from
// what the core knows; the plugin's own words are not part of it. Nothing is downloaded before the answer. Names are prefixed "downloads" because every feature file shares one global scope.
{
  const asked = new Set();
  const mb = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} bytes`);

  async function downloadsLook() {
    let list = [];
    try { list = (await (await fetch("/plugins/downloads")).json()).downloads ?? []; } catch { return; } // the core is not there: nothing to ask now
    for (const d of list) {
      if (asked.has(d.id)) continue;
      asked.add(d.id);
      const yes = await dialogConfirm({
        title: `Download "${d.name}" for the plugin ${d.title}?`,
        message: "The plugin asked aidea to download a program. aidea downloads it only if you accept, and checks that it is the file the plugin declared.",
        lines: [`What: ${d.name}`, `From: ${d.host}`, `Address: ${d.url}`, `Size: ${mb(d.bytes)}`],
        accept: "Download",
        cancel: "Not now",
      });
      await fetch("/plugins/downloads/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: d.id, decision: yes ? "accept" : "decline" }) }).catch(() => {});
    }
  }
  setInterval(downloadsLook, 2000);
}
