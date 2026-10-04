// The ?next= page to go to after signing in. Only paths on this same site
// are followed: "//evil.com", "/\evil.com" and paths with tabs or other
// control characters all resolve to other sites in browsers, so they fall
// back instead.
export function safeNextPath<T extends string | null>(value: string | null | undefined, fallback: T): string | T {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f\s]/.test(value)) {
    return fallback;
  }

  return value;
}
