// Does a piece of text look like a secret? The pure check behind the warning of the selection control (54-select.js), a file of its own so it can be read and tested apart.
// It is a warning, not a guarantee: the text is never changed or hidden.
// Does this text look like a secret? Made-up examples of each: a private key header, "DB_PASSWORD=hunter2hunter2", "password: correct-horse-9", "Bearer <long token>",
// a key with a known prefix (sk-, ghp_, AKIA...), "postgres://user:pass@host", or one long mixed-case string of letters and digits. Ids, hashes and paths are not flagged.
function selectLooksLikeSecret(value) {
  const t = value.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ""); // a UUID is an id, not a key
  const name = "\\b\\w*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)\\w*[\"']?";
  return [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    new RegExp(name + "\\s*=\\s*[\"']?[^\\s\"']{6,}", "i"), // NAME=value
    new RegExp(name + "\\s*:\\s*[\"']?(?=[^\\s\"']*\\d)[^\\s\"']{8,}", "i"), // name: value, only when the value has a digit ("Invalid token: expected string" is not a secret)
    /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}/,
    /\b(?:sk-|sk_live_|pk_live_|rk_live_|ghp_|gho_|ghs_|github_pat_|xox[baprs]-|AKIA|ASIA|AIza)[A-Za-z0-9_-]{12,}/,
    /[a-z][a-z0-9+.-]*:\/\/[^\s:@\/]+:[^\s@\/]+@/i,
    /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[a-z])(?=[A-Za-z0-9_-]*[A-Z])[A-Za-z0-9_-]{32,}\b/,
  ].some((re) => re.test(t));
}
