/**
 * Render terminates TLS and forwards plain HTTP. When TRUST_PROXY=1 (set on
 * Render by the start script), honor X-Forwarded-Proto and X-Forwarded-Host so
 * the request URL is the public https origin. Session cookies stay Secure.
 *
 * CORS allows only that public origin. The app is same-origin; this covers the
 * credentialed auth calls Better Auth makes from that host.
 */
interface ProxyEvent {
  url: URL;
  req: { method?: string; headers: Headers };
}

function publicOrigin(): string | undefined {
  const raw = process.env.BETTER_AUTH_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

function trustForwarded(event: ProxyEvent) {
  if (process.env.TRUST_PROXY !== "1") return;
  const proto = event.req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = event.req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (proto === "https" || proto === "http") event.url.protocol = `${proto}:`;
  if (host) {
    try {
      event.url.host = host;
    } catch {
      // Ignore a malformed forwarded host.
    }
  }
}

function corsHeaders(origin: string): Headers {
  const headers = new Headers();
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.set("vary", "origin");
  return headers;
}

export default async function trustProxy(
  event: ProxyEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  trustForwarded(event);
  const allowed = publicOrigin();
  const origin = event.req.headers.get("origin");
  const method = (event.req.method ?? "GET").toUpperCase();
  if (allowed && origin === allowed && method === "OPTIONS") {
    const headers = corsHeaders(origin);
    headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
    headers.set("access-control-allow-headers", "content-type, authorization");
    return new Response(null, { status: 204, headers });
  }
  const result = await next();
  if (allowed && origin === allowed && result instanceof Response) {
    const headers = new Headers(result.headers);
    for (const [key, value] of corsHeaders(origin)) headers.set(key, value);
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
  }
  return result;
}
