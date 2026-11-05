// The lesson a plugin can ship (plugin-lessons 01): a file named in the manifest (`lesson`), data in the shape of one part of the guide (src/core/guide.ts) plus
// `refs`, the things of the plugin each part talks about. The Tutor reads the lessons of the plugins that are installed and enabled, as untrusted data.
import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 64 * 1024;
const MAX_PARTS = 12;
const MAX_REFS = 20;
const TEXT_KEYS = ["name", "hint", "what", "question", "example", "narration", "tryIt"] as const;
const LIMIT: Record<(typeof TEXT_KEYS)[number], number> = { name: 80, hint: 120, what: 2000, question: 400, example: 600, narration: 400, tryIt: 400 };

export type LessonPart = { name: string; hint: string; what: string; question: string; example: string; narration: string; tryIt: string; refs: string[] };
export type Lesson = { parts: LessonPart[] };

// Reads and checks a lesson file inside a plugin folder. Every problem names the field, as the manifest's own do.
export function readLesson(dir: string, rel: string): { lesson: Lesson } | { problems: string[] } {
  let raw: unknown;
  try {
    const file = join(dir, rel);
    if (lstatSync(file).size > MAX_BYTES) return { problems: ['"lesson" is larger than 64 KiB'] };
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { problems: [(e as NodeJS.ErrnoException).code === "ENOENT" ? '"lesson" names a file that is missing' : '"lesson" is not valid JSON'] };
  }
  const parts = (raw as { parts?: unknown } | null)?.parts;
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > MAX_PARTS) return { problems: [`"lesson" must have "parts": a list of 1 to ${MAX_PARTS} parts`] };
  const problems: string[] = [];
  const lesson: LessonPart[] = [];
  parts.forEach((p, i) => {
    const at = `"lesson" part ${i + 1}`;
    if (!p || typeof p !== "object" || Array.isArray(p)) return void problems.push(`${at} must be an object`);
    const part = p as Record<string, unknown>;
    for (const k of TEXT_KEYS) {
      const v = part[k];
      if (typeof v !== "string" || !v.trim()) problems.push(`${at}: "${k}" must be text`);
      else if (v.length > LIMIT[k]) problems.push(`${at}: "${k}" is longer than ${LIMIT[k]} characters`);
    }
    const refs = part.refs ?? [];
    if (!Array.isArray(refs) || refs.length > MAX_REFS || refs.some((r) => typeof r !== "string" || !r || r.length > 100)) problems.push(`${at}: "refs" must be a list of up to ${MAX_REFS} short names`);
    else if (!problems.length) lesson.push({ ...(Object.fromEntries(TEXT_KEYS.map((k) => [k, part[k]])) as Omit<LessonPart, "refs">), refs: refs as string[] });
  });
  return problems.length ? { problems } : { lesson: { parts: lesson } };
}
