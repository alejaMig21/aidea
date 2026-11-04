// The Run plugin, host half: reads the run recipe (.aidea/run.json), keeps the person's consent to it, starts the parts in dependency order waiting for their ready signals,
// keeps their output and stops them (the whole process tree). The interface half calls the handlers below through the channel.
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";

const MAX_LINES = 2000; // lines kept for each part; older ones are dropped and counted
const DEFAULT_LIMIT = 60; // seconds to become ready
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the recipe -------------------------------------------------------------------------------------------------
function problems(json) {
  const errors = [];
  if (!json || typeof json !== "object" || !Array.isArray(json.parts) || !json.parts.length) return ['"parts" must be a list with at least one part'];
  const names = new Set();
  json.parts.forEach((p, i) => {
    const at = `parts[${i}]`;
    if (!p || typeof p !== "object") return void errors.push(`${at} must be an object`);
    if (typeof p.name !== "string" || !NAME.test(p.name)) errors.push(`${at}.name must be a short name of letters, digits, "." "_" or "-"`);
    else if (names.has(p.name)) errors.push(`${at}.name "${p.name}" is already used by another part`);
    else names.add(p.name);
    if (typeof p.command !== "string" || !p.command.trim()) errors.push(`${at}.command must be the command to run`);
    if (p.folder !== undefined && (typeof p.folder !== "string" || isAbsolute(p.folder) || normalize(p.folder).split(sep).includes(".."))) errors.push(`${at}.folder must be a folder inside the Project, written relative to it`);
    if (p.waitFor !== undefined && (!Array.isArray(p.waitFor) || p.waitFor.some((w) => typeof w !== "string"))) errors.push(`${at}.waitFor must be a list of part names`);
    if (p.ready !== undefined) {
      const kinds = p.ready && typeof p.ready === "object" ? Object.keys(p.ready) : [];
      const ok = kinds.length === 1 && ((kinds[0] === "port" && Number.isInteger(p.ready.port) && p.ready.port > 0 && p.ready.port < 65536) || (["line", "file", "url"].includes(kinds[0]) && typeof p.ready[kinds[0]] === "string" && p.ready[kinds[0]]));
      if (!ok) errors.push(`${at}.ready must be exactly one of { "port": number }, { "line": text }, { "file": path } or { "url": address }`);
    }
    if (p.timeoutSeconds !== undefined && !(typeof p.timeoutSeconds === "number" && p.timeoutSeconds > 0)) errors.push(`${at}.timeoutSeconds must be a number above zero`);
    if (p.env !== undefined && (!Array.isArray(p.env) || p.env.some((e) => typeof e !== "string"))) errors.push(`${at}.env must be a list of variable names`);
  });
  if (errors.length) return errors;
  json.parts.forEach((p, i) => { for (const w of p.waitFor ?? []) if (!names.has(w)) errors.push(`parts[${i}].waitFor names "${w}", which is not a part`); });
  if (errors.length) return errors;
  const by = Object.fromEntries(json.parts.map((p) => [p.name, p]));
  const visiting = new Set(), done = new Set();
  const visit = (name) => {
    if (done.has(name)) return false;
    if (visiting.has(name)) return true;
    visiting.add(name);
    const cyclic = (by[name].waitFor ?? []).some(visit);
    visiting.delete(name);
    done.add(name);
    return cyclic;
  };
  if (json.parts.some((p) => visit(p.name))) errors.push("the parts wait for each other in a cycle (waitFor)");
  return errors;
}

function readRecipe(root) {
  const file = join(root, ".aidea", "run.json");
  if (!existsSync(file)) return { state: "none" };
  const text = readFileSync(file, "utf8");
  let json;
  try { json = JSON.parse(text); } catch (e) { return { state: "invalid", errors: [`run.json is not valid JSON: ${e.message}`] }; }
  const errors = problems(json);
  if (errors.length) return { state: "invalid", errors };
  const parts = json.parts.map((p) => ({ name: p.name, command: p.command, folder: p.folder ?? ".", waitFor: p.waitFor ?? [], ready: p.ready ?? null, timeoutSeconds: p.timeoutSeconds ?? DEFAULT_LIMIT, env: p.env ?? [] }));
  return { state: "ok", recipe: { parts }, hash: createHash("sha256").update(JSON.stringify(parts)).digest("hex") };
}

// What changed between the accepted recipe and the one on disk, by part name.
function difference(old, now) {
  const before = Object.fromEntries(old.parts.map((p) => [p.name, JSON.stringify(p)])), after = Object.fromEntries(now.parts.map((p) => [p.name, JSON.stringify(p)]));
  return { added: Object.keys(after).filter((n) => !(n in before)), removed: Object.keys(before).filter((n) => !(n in after)), changed: Object.keys(after).filter((n) => n in before && before[n] !== after[n]) };
}

// ---- processes --------------------------------------------------------------------------------------------------
const win = process.platform === "win32";
function killTree(entry) {
  return new Promise((done) => {
    if (!entry.alive) return done();
    const finish = () => { clearTimeout(timer); done(); };
    const timer = setTimeout(done, 5000);
    entry.proc.once("exit", finish);
    if (win) execFile("taskkill", ["/pid", String(entry.proc.pid), "/T", "/F"], { windowsHide: true }, () => {});
    else { try { process.kill(-entry.proc.pid, "SIGKILL"); } catch { try { entry.proc.kill("SIGKILL"); } catch { /* already gone */ } } }
  });
}

const portAnswers = (port) => new Promise((res) => { const c = connect(port, "127.0.0.1"); c.on("connect", () => { c.destroy(); res(true); }); c.on("error", () => res(false)); });
async function isReady(entry, root) {
  const r = entry.part.ready;
  if (!r) return true;
  if ("port" in r) return portAnswers(r.port);
  if ("line" in r) return entry.sawLine;
  if ("file" in r) return existsSync(resolve(root, r.file));
  try { await fetch(r.url, { signal: AbortSignal.timeout(1000) }); return true; } catch { return false; } // any answer at all means it is up
}

export function activate(ctx) {
  const dataFile = () => join(ctx.data.dir, "accepted.json"); // the memory of what the person accepted: outside the Project, so a pull cannot change it
  const accepted = () => { try { return JSON.parse(readFileSync(dataFile(), "utf8")); } catch { return {}; } };
  const runs = new Map(); // Project folder -> { parts: Map name -> entry, order: [names in start order], stoppedOrder: [] }

  const rootOf = (body) => {
    const root = typeof body?.project === "string" ? ctx.projects.path(body.project) : undefined;
    if (!root) throw new Error("the Project is not open");
    return root;
  };
  const runOf = (root) => { if (!runs.has(root)) runs.set(root, { parts: new Map(), order: [], stoppedOrder: [] }); return runs.get(root); };

  function spawnPart(root, run, part) {
    const entry = { part, lines: [], dropped: 0, alive: true, exit: null, sawLine: !(part.ready && "line" in part.ready), partial: "", stopped: false };
    const push = (text) => {
      const lines = (entry.partial + text).split(/\r?\n/);
      entry.partial = lines.pop();
      for (const line of lines) {
        entry.lines.push(line);
        if (part.ready && "line" in part.ready && line.includes(part.ready.line)) entry.sawLine = true;
      }
      if (entry.lines.length > MAX_LINES) { entry.dropped += entry.lines.length - MAX_LINES; entry.lines.splice(0, entry.lines.length - MAX_LINES); }
    };
    const env = { ...process.env };
    entry.proc = spawn(part.command, { cwd: resolve(root, part.folder), shell: true, windowsHide: true, detached: !win, stdio: ["ignore", "pipe", "pipe"], env });
    entry.proc.stdout.on("data", (d) => push(String(d)));
    entry.proc.stderr.on("data", (d) => push(String(d)));
    entry.proc.on("error", (e) => push(`could not start: ${e.message}\n`));
    entry.proc.on("exit", (code) => { if (entry.partial) { entry.lines.push(entry.partial); entry.partial = ""; } entry.alive = false; entry.exit = code; });
    run.parts.set(part.name, entry);
    run.order.push(part.name);
    return entry;
  }

  // Waits for the ready signal of a part; rejects when it exits first or its limit passes.
  async function ready(root, run, entry) {
    const limit = Date.now() + entry.part.timeoutSeconds * 1000;
    for (;;) {
      if (run.cancelled) throw { part: entry.part.name, why: "Play was cancelled" };
      if (!entry.alive) {
        if (!entry.part.ready && entry.exit === 0) return; // a part with no ready signal that finished cleanly (a one-off task) counts as ready
        throw { part: entry.part.name, why: `exited with code ${entry.exit} before it was ready` };
      }
      if (await isReady(entry, root)) return;
      if (Date.now() > limit) throw { part: entry.part.name, why: `was not ready after ${entry.part.timeoutSeconds} seconds` };
      await wait(100);
    }
  }

  async function stopNames(run, names) {
    // Reverse of the start order: what started last stops first.
    const order = run.order.filter((n) => names.includes(n)).reverse();
    const stopped = [];
    for (const name of order) {
      const entry = run.parts.get(name);
      if (entry?.alive) { entry.stopped = true; await killTree(entry); }
      stopped.push(name);
    }
    run.order = run.order.filter((n) => !names.includes(n));
    return stopped;
  }

  const lastLines = (entry) => entry.lines.slice(-20);

  // Starts `names` (a set of parts of the recipe) in dependency order; the parts outside the set are taken as ready when alive.
  async function startSet(root, recipe, run, names) {
    const by = Object.fromEntries(recipe.parts.map((p) => [p.name, p]));
    const started = new Map();
    const go = (name) => {
      if (!started.has(name)) started.set(name, (async () => {
        const part = by[name];
        await Promise.all(part.waitFor.filter((w) => names.includes(w)).map(go));
        if (run.cancelled) throw { part: name, why: "Play was cancelled" };
        const entry = spawnPart(root, run, part);
        await ready(root, run, entry);
      })());
      return started.get(name);
    };
    run.cancelled = false;
    try {
      await Promise.all(names.map(go));
      return { started: true };
    } catch (failure) {
      run.cancelled = true;
      const entry = run.parts.get(failure.part);
      const lines = entry ? lastLines(entry) : [];
      await stopNames(run, [...run.order]);
      return { started: false, reason: "failed", failed: { part: failure.part, why: failure.why, lastLines: lines }, hint: "Open the Terminal to see the errors in depth." };
    }
  }

  function check(root) {
    const r = readRecipe(root);
    if (r.state !== "ok") return { r, refusal: r.state === "none" ? { started: false, reason: "no-recipe" } : { started: false, reason: "invalid-recipe", errors: r.errors } };
    const before = accepted()[root];
    if (before?.hash === r.hash) return { r };
    return { r, refusal: { started: false, reason: "needs-accept", ...(before ? { changes: difference(before.recipe, r.recipe) } : { whole: r.recipe }) } };
  }

  const dependentsOf = (recipe, name) => {
    const set = new Set([name]);
    for (let grew = true; grew;) { grew = false; for (const p of recipe.parts) if (!set.has(p.name) && p.waitFor.some((w) => set.has(w))) { set.add(p.name); grew = true; } }
    return recipe.parts.map((p) => p.name).filter((n) => set.has(n));
  };

  ctx.api.handle("status", (body) => {
    const root = rootOf(body);
    const { r, refusal } = check(root);
    return { recipe: r.state === "ok" ? { state: refusal ? "needs-accept" : "accepted", parts: r.recipe.parts.map((p) => p.name) } : { state: r.state, errors: r.errors } };
  });
  ctx.api.handle("accept", (body) => {
    const root = rootOf(body);
    const r = readRecipe(root);
    if (r.state !== "ok") throw new Error("there is no valid recipe to accept");
    mkdirSync(ctx.data.dir, { recursive: true });
    writeFileSync(dataFile(), JSON.stringify({ ...accepted(), [root]: { hash: r.hash, recipe: r.recipe } }));
    return { accepted: true };
  });
  ctx.api.handle("play", async (body) => {
    const root = rootOf(body);
    const { r, refusal } = check(root);
    if (refusal) return refusal;
    const run = runOf(root);
    const idle = r.recipe.parts.map((p) => p.name).filter((n) => !run.parts.get(n)?.alive);
    if (!idle.length) return { started: true, already: true };
    for (const n of idle) run.parts.delete(n); // a new tab replaces the old one of a part that had stopped
    return startSet(root, r.recipe, run, idle);
  });
  ctx.api.handle("stop", async (body) => {
    const root = rootOf(body);
    const run = runOf(root);
    const names = typeof body.part === "string" ? [body.part] : [...run.order];
    const stopped = await stopNames(run, names);
    if (typeof body.part !== "string") run.stoppedOrder = stopped;
    return { stopped };
  });
  ctx.api.handle("restart", async (body) => {
    const root = rootOf(body);
    const { r, refusal } = check(root);
    if (refusal) return refusal;
    if (!r.recipe.parts.some((p) => p.name === body.part)) throw new Error("that part is not in the recipe");
    const run = runOf(root);
    const names = dependentsOf(r.recipe, body.part);
    await stopNames(run, names);
    for (const n of names) run.parts.delete(n);
    return startSet(root, r.recipe, run, names);
  });
  ctx.api.handle("output", (body) => {
    const root = rootOf(body);
    const run = runOf(root);
    return {
      parts: [...run.parts.values()].map((e) => ({ name: e.part.name, alive: e.alive, exit: e.exit, stopped: e.stopped, lines: e.lines.slice(), dropped: e.dropped })),
      stoppedOrder: run.stoppedOrder,
    };
  });

  // Deactivating the plugin (or closing aidea) stops everything Play started.
  return async () => { for (const run of runs.values()) await stopNames(run, [...run.order]); };
}
