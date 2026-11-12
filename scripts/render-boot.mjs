#!/usr/bin/env node
/**
 * Hits a running production server: health, four sign-ups, and a 3-approval
 * jar withdrawal that does not move money.
 *
 *   BASE_URL=http://127.0.0.1:8080 node scripts/render-boot.mjs
 */
const base = (process.env.BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const stamp = Date.now();

function client() {
  const jar = new Map();
  return {
    async fetch(path, options = {}) {
      const headers = new Headers(options.headers);
      headers.set("origin", base);
      if (jar.size) headers.set("cookie", [...jar].map(([key, value]) => `${key}=${value}`).join("; "));
      const response = await fetch(base + path, { ...options, headers, redirect: "manual" });
      for (const cookie of response.headers.getSetCookie?.() ?? []) {
        const [pair] = cookie.split(";");
        const eq = pair.indexOf("=");
        jar.set(pair.slice(0, eq), pair.slice(eq + 1));
      }
      const text = await response.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      return { status: response.status, body, setCookie: response.headers.getSetCookie?.() ?? [] };
    },
  };
}

async function waitForHealth() {
  const deadline = Date.now() + 60_000;
  let last = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/healthz`);
      const text = await response.text();
      if (response.status === 200 && text.trim() === "ok") return;
      last = `${response.status} ${text}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`healthz did not become ok: ${last}`);
}

async function signup(name, email) {
  const api = client();
  const created = await api.fetch("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, email, password: "correct-horse" }),
  });
  if (created.status >= 400 || !created.body?.user?.id) {
    throw new Error(`signup ${email} failed: ${created.status} ${JSON.stringify(created.body)}`);
  }
  const sessionCookie = created.setCookie.find((cookie) => cookie.includes("session_token"));
  if (!sessionCookie || !/httponly/i.test(sessionCookie) || !/secure/i.test(sessionCookie)) {
    throw new Error("session cookie is missing, not HttpOnly, or not Secure");
  }
  return { api, user: created.body.user };
}

await waitForHealth();

const home = await fetch(`${base}/`);
const homeHtml = await home.text();
const homeType = home.headers.get("content-type") ?? "";
if (home.status !== 200 || !homeType.includes("text/html")) {
  throw new Error(`home is not the app: ${home.status} ${homeType}`);
}
if (homeHtml.includes("/between-us/")) {
  throw new Error("frontend is mounted under /between-us/");
}

const probed = await fetch(`${base}/healthz`, {
  headers: {
    "x-trust-probe": "1",
    "x-forwarded-proto": "https",
    "x-forwarded-host": "between-us.onrender.com",
  },
});
if (probed.headers.get("x-request-url") !== "https://between-us.onrender.com") {
  throw new Error(`trust proxy did not rewrite the request URL (${probed.headers.get("x-request-url")})`);
}

const preflight = await fetch(`${base}/api/auth/sign-in/email`, {
  method: "OPTIONS",
  headers: { origin: base },
});
if (preflight.headers.get("access-control-allow-origin") !== base) {
  throw new Error("CORS did not allow the public origin");
}

const ada = await signup("Ada", `ada-${stamp}@example.com`);
const maya = await signup("Maya", `maya-${stamp}@example.com`);
const jonah = await signup("Jonah", `jonah-${stamp}@example.com`);
const priya = await signup("Priya", `priya-${stamp}@example.com`);

const circle = await ada.api.fetch("/api/books/circles", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "House" }),
});
if (!circle.body?.ok) throw new Error(`circle ${JSON.stringify(circle.body)}`);
const circleId = circle.body.id;

for (const person of [maya, jonah, priya]) {
  const added = await ada.api.fetch(`/api/books/circles/${circleId}/members`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: person.user.email }),
  });
  if (!added.body?.ok) throw new Error(`member ${person.user.email} ${JSON.stringify(added.body)}`);
}

const jar = await ada.api.fetch("/api/books/jars", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ circleId, name: "Friday", goalCents: 4000 }),
});
if (!jar.body?.ok) throw new Error(`jar ${JSON.stringify(jar.body)}`);

const snap = await ada.api.fetch(`/api/books/circles/${circleId}`);
const others = snap.body.snapshot.members.filter((member) => member.user_id !== ada.user.id);
for (const member of others) {
  const added = await ada.api.fetch(`/api/books/jars/${jar.body.id}/members`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: member.user_id }),
  });
  if (!added.body?.ok) throw new Error(`jar member ${JSON.stringify(added.body)}`);
}

const withdrawal = await ada.api.fetch("/api/books/withdrawals", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jarId: jar.body.id,
    amountCents: 2000,
    destinationUserId: maya.user.id,
    purpose: "Groceries",
  }),
});
if (!withdrawal.body?.ok) throw new Error(`withdrawal ${JSON.stringify(withdrawal.body)}`);

const self = await ada.api.fetch(`/api/books/withdrawals/${withdrawal.body.id}/approve`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ userId: maya.user.id }),
});
if (self.body?.ok) throw new Error("requester approval must fail");

for (const person of [maya, jonah, priya]) {
  const vote = await person.api.fetch(`/api/books/withdrawals/${withdrawal.body.id}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "someone-else" }),
  });
  if (!vote.body?.ok) throw new Error(`vote ${person.user.email} ${JSON.stringify(vote.body)}`);
}

const after = await ada.api.fetch(`/api/books/circles/${circleId}`);
const request = after.body.snapshot.jars[0].withdrawals[0];
if (request.standing !== "policy_approved" || request.yesCount !== 3) {
  throw new Error(`expected 3 approvals, got ${JSON.stringify(request)}`);
}
if (after.body.snapshot.jars[0].confirmedCents !== 0) {
  throw new Error("confirmed funds must stay zero");
}

const checked = await ada.api.fetch(`/api/books/withdrawals/${withdrawal.body.id}/check`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ idempotencyKey: "boot-check" }),
});
if (checked.body?.fundsMoved !== false || !checked.body?.reasons?.includes("transfers_disabled")) {
  throw new Error(`transfer was not disabled: ${JSON.stringify(checked.body)}`);
}

console.log("render boot ok: healthz, 4 users, 3 approvals, no transfer");
