/** Only same-site paths are valid post-login targets; anything else (absolute URLs, //host, /\host, tab/newline tricks) becomes undefined. */
export function safeNext(next: string | string[] | undefined): string | undefined {
  const n = Array.isArray(next) ? next[0] : next;
  if (!n || !/^\/(?![/\\])/.test(n)) return undefined;
  // URL parsers strip tab/CR/LF, so "/\t/evil.com" would become "//evil.com"; reject any control char or space.
  for (let i = 0; i < n.length; i++) {
    const c = n.charCodeAt(i);
    if (c <= 0x20 || c === 0x7f) return undefined;
  }
  try {
    return new URL(n, "http://x").origin === "http://x" ? n : undefined;
  } catch {
    return undefined;
  }
}
