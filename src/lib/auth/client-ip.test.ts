import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getIp } from "@better-auth/core/utils/ip";
import { betterAuth } from "better-auth";
import {
  proxyTrustEnabled,
  rateLimitIpAddress,
  TRUSTED_CLIENT_IP_HEADERS,
  UNTRUSTED_CLIENT_IP_HEADERS,
} from "./client-ip.ts";

const VISITOR = "203.0.113.10";
const OTHER = "203.0.113.20";
const SPOOFED = "198.51.100.9";
const PROXY = "104.16.0.5";

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

function clientIp(trustProxy: boolean, init: Record<string, string>): string | null {
  return getIp(headers(init), { advanced: { ipAddress: rateLimitIpAddress(trustProxy) } });
}

describe("proxy trust", () => {
  it("is on only for TRUST_PROXY=1", () => {
    assert.equal(proxyTrustEnabled({}), false);
    assert.equal(proxyTrustEnabled({ TRUST_PROXY: "" }), false);
    assert.equal(proxyTrustEnabled({ TRUST_PROXY: "0" }), false);
    assert.equal(proxyTrustEnabled({ TRUST_PROXY: "true" }), false);
    assert.equal(proxyTrustEnabled({ TRUST_PROXY: "yes" }), false);
    assert.equal(proxyTrustEnabled({ TRUST_PROXY: "1" }), true);
  });

  it("selects Cloudflare's header ahead of the forwarded chain only when trusted", () => {
    assert.deepEqual(rateLimitIpAddress(true).ipAddressHeaders, [...TRUSTED_CLIENT_IP_HEADERS]);
    assert.equal(TRUSTED_CLIENT_IP_HEADERS[0], "cf-connecting-ip");
    assert.equal(rateLimitIpAddress(true).ipAddressHeaders.includes("x-real-ip"), false);
    assert.deepEqual(rateLimitIpAddress(false).ipAddressHeaders, [...UNTRUSTED_CLIENT_IP_HEADERS]);
    assert.deepEqual([...UNTRUSTED_CLIENT_IP_HEADERS], ["x-forwarded-for"]);
  });

  it("reads TRUST_PROXY when the auth server builds its options", () => {
    const previous = process.env.TRUST_PROXY;
    try {
      delete process.env.TRUST_PROXY;
      assert.deepEqual(rateLimitIpAddress().ipAddressHeaders, [...UNTRUSTED_CLIENT_IP_HEADERS]);
      process.env.TRUST_PROXY = "1";
      assert.deepEqual(rateLimitIpAddress().ipAddressHeaders, [...TRUSTED_CLIENT_IP_HEADERS]);
    } finally {
      if (previous === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = previous;
    }
  });
});

describe("Better Auth getIp", () => {
  it("uses cf-connecting-ip and ignores a spoofed forwarded chain when the proxy is trusted", () => {
    assert.equal(
      clientIp(true, {
        "CF-Connecting-IP": ` ${VISITOR} `,
        "x-real-ip": SPOOFED,
        "x-forwarded-for": `${SPOOFED}, ${VISITOR}, ${PROXY}`,
      }),
      VISITOR,
    );
  });

  it("uses true-client-ip when Cloudflare's connecting header is absent", () => {
    assert.equal(
      clientIp(true, {
        "true-client-ip": OTHER,
        "x-forwarded-for": `${SPOOFED}, ${PROXY}`,
        "x-real-ip": SPOOFED,
      }),
      OTHER,
    );
  });

  it("accepts a single x-forwarded-for from a proxy that replaced the header", () => {
    assert.equal(clientIp(true, { "x-forwarded-for": VISITOR }), VISITOR);
  });

  it("does not take the leftmost hop of a forwarded chain", () => {
    assert.equal(clientIp(true, { "x-forwarded-for": `${SPOOFED}, ${VISITOR}, ${PROXY}` }), null);
    assert.equal(clientIp(false, { "x-forwarded-for": `${SPOOFED}, ${VISITOR}, ${PROXY}` }), null);
  });

  it("does not trust x-real-ip, which a client can still supply", () => {
    assert.equal(clientIp(true, { "x-real-ip": SPOOFED }), null);
    assert.equal(
      clientIp(true, {
        "x-real-ip": SPOOFED,
        "x-forwarded-for": `${SPOOFED}, ${PROXY}`,
      }),
      null,
    );
  });

  it("falls through an unusable Cloudflare header to a single forwarded address", () => {
    assert.equal(
      clientIp(true, {
        "cf-connecting-ip": `${SPOOFED}, ${VISITOR}`,
        "x-forwarded-for": VISITOR,
      }),
      VISITOR,
    );
    assert.equal(
      clientIp(true, {
        "cf-connecting-ip": "not-an-ip",
        "x-forwarded-for": OTHER,
      }),
      OTHER,
    );
  });

  it("normalizes an IPv6 visitor address", () => {
    assert.equal(
      clientIp(true, { "cf-connecting-ip": "2001:db8::1" }),
      "2001:0db8:0000:0000:0000:0000:0000:0000",
    );
  });

  it("ignores proxy identity headers when the proxy is not trusted", () => {
    assert.equal(
      clientIp(false, {
        "cf-connecting-ip": VISITOR,
        "true-client-ip": OTHER,
        "x-real-ip": SPOOFED,
      }),
      null,
    );
    assert.equal(clientIp(false, { "x-forwarded-for": VISITOR }), VISITOR);
    assert.equal(clientIp(true, {}), null);
    assert.equal(clientIp(false, {}), null);
  });
});

describe("auth rate-limit buckets", () => {
  const secret = "ci-client-ip-rate-limit-secret-32ch";
  const trusted = betterAuth({
    baseURL: "http://localhost:8080",
    secret,
    emailAndPassword: { enabled: true },
    logger: { disabled: true },
    advanced: { ipAddress: rateLimitIpAddress(true) },
    rateLimit: { enabled: true, window: 60, max: 100 },
  });
  const untrusted = betterAuth({
    baseURL: "http://localhost:8080",
    secret,
    emailAndPassword: { enabled: true },
    logger: { disabled: true },
    advanced: { ipAddress: rateLimitIpAddress(false) },
    rateLimit: { enabled: true, window: 60, max: 100 },
  });

  let sequence = 0;

  async function post(
    auth: typeof trusted,
    path: string,
    extra: Record<string, string>,
  ): Promise<{ status: number; body: string }> {
    sequence += 1;
    const response = await auth.handler(
      new Request(`http://localhost:8080/api/auth/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:8080",
          ...extra,
        },
        body: JSON.stringify({
          name: "Ada",
          email: `visitor-${sequence}@example.com`,
          password: "correct-horse",
        }),
      }),
    );
    return { status: response.status, body: await response.text() };
  }

  async function statuses(
    auth: typeof trusted,
    path: string,
    each: (index: number) => Record<string, string>,
    count = 4,
  ): Promise<number[]> {
    const codes: number[] = [];
    for (let index = 0; index < count; index += 1) {
      codes.push((await post(auth, path, each(index))).status);
    }
    return codes;
  }

  it("gives each Cloudflare visitor their own sign-up bucket", async () => {
    const distinct = await statuses(trusted, "sign-up/email", (index) => ({
      "cf-connecting-ip": `203.0.113.${index + 1}`,
      "x-forwarded-for": `${SPOOFED}, 203.0.113.${index + 1}, ${PROXY}`,
      "x-real-ip": SPOOFED,
    }));
    assert.deepEqual(distinct, [200, 200, 200, 200]);

    const again = await statuses(
      trusted,
      "sign-up/email",
      () => ({
        "cf-connecting-ip": "203.0.113.1",
        "x-forwarded-for": `198.51.100.${sequence}, 203.0.113.1, ${PROXY}`,
        "x-real-ip": `198.51.100.${sequence}`,
      }),
      3,
    );
    // The first request above already counted for 203.0.113.1, so two more
    // fit in the window of 3 and the next one is rejected.
    assert.deepEqual(again, [200, 200, 429]);
    const blocked = await post(trusted, "sign-up/email", {
      "cf-connecting-ip": "203.0.113.1",
      "x-real-ip": OTHER,
    });
    assert.equal(blocked.status, 429);
    assert.match(blocked.body, /Too many requests/);

    const someoneElse = await post(trusted, "sign-up/email", {
      "cf-connecting-ip": "203.0.113.50",
      "x-forwarded-for": `${SPOOFED}, 203.0.113.50`,
    });
    assert.equal(someoneElse.status, 200);
  });

  it("keeps a forwarded chain on one shared bucket when no Cloudflare address is present", async () => {
    const codes = await statuses(trusted, "sign-in/email", (index) => ({
      "x-forwarded-for": `198.51.100.${index + 1}, ${VISITOR}, ${PROXY}`,
      "x-real-ip": `198.51.100.${index + 1}`,
    }));
    assert.deepEqual(codes.slice(0, 3), [401, 401, 401]);
    assert.equal(codes[3], 429);
  });

  it("does not let an untrusted caller split buckets with proxy headers", async () => {
    const forged = await statuses(untrusted, "change-password", (index) => ({
      "cf-connecting-ip": `203.0.113.${index + 1}`,
      "true-client-ip": `203.0.113.${index + 10}`,
      "x-real-ip": `198.51.100.${index + 1}`,
    }));
    assertSharedBucket(forged);

    const chain = await statuses(untrusted, "forget-password", (index) => ({
      "cf-connecting-ip": `203.0.113.${index + 30}`,
      "x-forwarded-for": `198.51.100.${index + 1}, ${PROXY}`,
    }));
    assertSharedBucket(chain);
  });

  it("still rate-limits a single replaced x-forwarded-for per address when untrusted", async () => {
    const codes = await statuses(untrusted, "request-password-reset", (index) => ({
      "x-forwarded-for": `203.0.113.${index + 60}`,
      "cf-connecting-ip": SPOOFED,
      "x-real-ip": SPOOFED,
    }));
    assert.equal(
      codes.some((code) => code === 429),
      false,
    );
  });

  it("does not treat x-real-ip as the visitor even behind a trusted proxy", async () => {
    const codes = await statuses(trusted, "send-verification-email", (index) => ({
      "x-real-ip": `203.0.113.${index + 70}`,
    }));
    assertSharedBucket(codes);
  });
});

function assertSharedBucket(codes: number[]) {
  assert.equal(codes.length, 4);
  assert.equal(
    codes.slice(0, 3).some((code) => code === 429),
    false,
  );
  assert.equal(codes[3], 429);
}
