// Layout presets (layout-and-data 09). The page does the arranging; the core only checks what it is given and remembers it, in the per-user preferences file.
// A preset is the state the page saves for its Layout (which Panels are folded and `dock`, the arrangement as the docking library describes it), kept under a name.
export const BUILT_IN_PRESETS = ["Default", "Classic IDE", "Canvas only"] as const; // the page builds these three itself; they cannot be overwritten, renamed or deleted
export const DEFAULT_PRESET = "Default";
const MAX_PRESETS = 20, MAX_NAME = 40, MAX_STATE_CHARS = 200_000, MAX_PROJECTS = 200;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const small = (v: unknown) => isObject(v) && JSON.stringify(v).length <= MAX_STATE_CHARS;
const keyOf = (name: string) => name.trim().toLowerCase(); // names are compared without capitals or edge spaces

// The set of the person's own presets, as a whole: every change (save, rename, delete) sends the whole set, which is checked as one.
export function validPresets(v: unknown): boolean {
  if (!isObject(v)) return false;
  const names = Object.keys(v);
  if (names.length > MAX_PRESETS) return false;
  const seen = new Set<string>();
  for (const name of names) {
    const key = keyOf(name);
    if (!key || name.trim().length > MAX_NAME || /[\u0000-\u001f\u007f]/.test(name)) return false;
    if (BUILT_IN_PRESETS.some((b) => keyOf(b) === key) || seen.has(key)) return false;
    seen.add(key);
    if (!small(v[name])) return false;
  }
  return true;
}

// The Layout of each Project, by the Project's path, for when the person chose to remember a Layout for each Project.
export function validProjectLayouts(v: unknown): boolean {
  return isObject(v) && Object.keys(v).length <= MAX_PROJECTS && Object.values(v).every(small);
}

export const validLayoutScope = (v: unknown) => v === "shared" || v === "project";
