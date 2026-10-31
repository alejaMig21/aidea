// What the core kept for the page between launches (src/core/routes/ui.ts): { layout, notation, speed, sections }. The core serves it in a <meta> and takes each part
// back with a PUT. The page's localStorage stays as the fallback (a page served without it): the desktop app has a new address at every launch, and localStorage
// belongs to one address, so on its own it forgets everything at each relaunch. Names start with "saved" because every feature file shares one global scope.
const savedServed = (() => { try { return JSON.parse(decodeURIComponent(document.querySelector("meta[name=aidea-saved]")?.content ?? "")) ?? {}; } catch { return {}; } })();
const savedPut = (name, value) => { fetch(`/ui/${name}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(value), keepalive: true }).catch(() => {}); }; // not saved: the page still works
