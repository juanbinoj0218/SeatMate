// Response headers every SeatMate site sends (next.config.ts `headers()`).
// They stop other sites from framing our pages (clickjacking), stop browsers
// guessing file types, and keep full page URLs out of the Referer header
// sent to other sites.
export const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

export const securityHeadersConfig = async () => [
  { source: "/:path*", headers: securityHeaders },
];
