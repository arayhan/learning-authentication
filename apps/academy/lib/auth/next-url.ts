/** Only same-site paths are valid post-login targets; anything else (absolute URLs, //host, /\host) becomes undefined. */
export function safeNext(next: string | string[] | undefined): string | undefined {
  const n = Array.isArray(next) ? next[0] : next;
  return n && /^\/(?![/\\])/.test(n) ? n : undefined;
}
