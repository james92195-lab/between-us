/**
 * Client IP headers for Better Auth rate limits.
 *
 * Better Auth keys its limiter on the client address and, with no
 * `trustedProxies`, accepts a forwarded header only when that header holds
 * exactly one IP. On Render the edge is Cloudflare: it appends to
 * `x-forwarded-for` (so the header is a chain, and the leftmost hop is
 * whatever the client sent) and puts the visitor address in `cf-connecting-ip`,
 * which it overwrites. The default config therefore resolves no address, logs
 * "could not determine a client IP", and puts every caller in one bucket per
 * auth path. Sign-up allows 3 requests per 10 seconds in that bucket, so a
 * fourth person is rejected with 429.
 *
 * `TRUST_PROXY=1` (Render) is what opts into the headers a proxy in front of
 * this process sets. Without it, `cf-connecting-ip` and `true-client-ip` are
 * not read — a direct caller could otherwise pick any rate-limit key — and a
 * multi-value `x-forwarded-for` is still rejected. A single `x-forwarded-for`
 * stays acceptable, which is Better Auth's own default for a proxy that
 * replaces the header with one address.
 *
 * `x-real-ip` is not listed. Cloudflare strips it instead of replacing it, so
 * a value that still shows up can be one the client chose. Listing it as a
 * fallback would let that forged address win whenever `cf-connecting-ip` was
 * missing and `x-forwarded-for` was a chain.
 *
 * srvx `trustProxy` (patched into the Render server) only fixes the public
 * URL and `request.ip`. Better Auth never reads `request.ip`, and srvx takes
 * the leftmost `x-forwarded-for` hop, which is the spoofable one. The header
 * list below is what the limiter actually uses.
 */

/** Headers read when `TRUST_PROXY=1`, first match wins. */
export const TRUSTED_CLIENT_IP_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-forwarded-for",
] as const;

/**
 * Headers read when the process is not behind a trusted proxy.
 * Matches Better Auth's default: one address in `x-forwarded-for` only.
 */
export const UNTRUSTED_CLIENT_IP_HEADERS = ["x-forwarded-for"] as const;

/** True only for the Render flag. `"true"` / `"yes"` do not enable it. */
export function proxyTrustEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TRUST_PROXY === "1";
}

/** `advanced.ipAddress` for `betterAuth`. Evaluated when the auth module loads. */
export function rateLimitIpAddress(trustProxy = proxyTrustEnabled()): {
  ipAddressHeaders: string[];
} {
  return {
    ipAddressHeaders: [...(trustProxy ? TRUSTED_CLIENT_IP_HEADERS : UNTRUSTED_CLIENT_IP_HEADERS)],
  };
}
