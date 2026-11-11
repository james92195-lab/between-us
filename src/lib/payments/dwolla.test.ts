import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { emptyBook } from "../book.ts";
import { assessWithdrawalPayload } from "./assess.ts";
import {
  DWOLLA_SANDBOX_ORIGIN,
  buildPlaidWebExchangeSession,
  buildUserToUserTransfer,
  decideDwollaWebhook,
  jarDispatchAllowed,
  loanDispatchAllowed,
  postSandboxTransfer,
  publicDwollaStatus,
  readDwollaEnv,
  verifyDwollaSignature,
} from "./dwolla.ts";

const source = `${DWOLLA_SANDBOX_ORIGIN}/funding-sources/80275e83-1f9d-4bf7-8816-2ddcd5ffc197`;
const destination = `${DWOLLA_SANDBOX_ORIGIN}/funding-sources/375c6781-2a17-476c-84f7-db7d2f6ffb31`;

test("unset env cannot dispatch loans or the jar", () => {
  const env = readDwollaEnv({});
  const status = publicDwollaStatus(env);
  assert.equal(status.liveTransfers, false);
  assert.equal(status.jarPooling, false);
  assert.equal(status.sandboxDispatchArmed, false);
  assert.equal(status.fundsMoved, false);
  assert.equal(loanDispatchAllowed(env).ok, false);
  assert.equal(jarDispatchAllowed().ok, false);
});

test("a fully filled sandbox env still cannot pool the jar", () => {
  const env = readDwollaEnv({
    DWOLLA_ENVIRONMENT: "sandbox",
    DWOLLA_CLIENT_ID: "id",
    DWOLLA_CLIENT_SECRET: "secret",
    DWOLLA_WEBHOOK_SECRET: "whsec",
    DWOLLA_PLAID_EXCHANGE_PARTNER_HREF: `${DWOLLA_SANDBOX_ORIGIN}/exchange-partners/292317ec-e252-47d8-93c3-2d128e037aa4`,
    DWOLLA_P2P_APPROVAL: "written-approval-on-file",
    DWOLLA_LAUNCH_COUNTRY: "US",
    DWOLLA_SANDBOX_DISPATCH: "enabled",
  });
  assert.equal(loanDispatchAllowed(env).ok, true);
  const jar = jarDispatchAllowed();
  assert.equal(jar.ok, false);
  if (jar.ok) return;
  assert.equal(jar.code, "jar_custody_not_approved");
  const status = publicDwollaStatus(env);
  assert.equal(status.liveTransfers, false);
  assert.equal(status.jarPooling, false);
  assert.equal(status.credentialsPresent.clientSecret, true);
  const published = JSON.stringify(status);
  assert.equal(published.includes("whsec"), false);
  assert.equal(published.includes("exchange-partners"), false);
});

test("production stays off even with the approval phrase", () => {
  const env = readDwollaEnv({
    DWOLLA_ENVIRONMENT: "production",
    DWOLLA_CLIENT_ID: "id",
    DWOLLA_CLIENT_SECRET: "secret",
    DWOLLA_P2P_APPROVAL: "written-approval-on-file",
    DWOLLA_LAUNCH_COUNTRY: "US",
    DWOLLA_SANDBOX_DISPATCH: "enabled",
  });
  const decision = loanDispatchAllowed(env);
  assert.equal(decision.ok, false);
  if (decision.ok) return;
  assert.equal(decision.code, "production_disabled");
});

test("transfer body uses server cents and rejects bank numbers and non-sandbox hosts", () => {
  const built = buildUserToUserTransfer({
    amountCents: 1050,
    sourceFundingSourceHref: source,
    destinationFundingSourceHref: destination,
    correlationId: "8a2cdc8d-629d-4a24-98ac-40b735229fe2",
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.deepEqual(built.value.amount, { currency: "USD", value: "10.50" });
  assert.equal(JSON.stringify(built.value).includes("routingNumber"), false);
  const bad = buildUserToUserTransfer({
    amountCents: 1050,
    sourceFundingSourceHref: "https://api.dwolla.com/funding-sources/80275e83-1f9d-4bf7-8816-2ddcd5ffc197",
    destinationFundingSourceHref: destination,
    correlationId: "8a2cdc8d-629d-4a24-98ac-40b735229fe2",
  });
  assert.equal(bad.ok, false);
});

test("plaid exchange session is only an exchange-partner link", () => {
  const session = buildPlaidWebExchangeSession(
    `${DWOLLA_SANDBOX_ORIGIN}/exchange-partners/292317ec-e252-47d8-93c3-2d128e037aa4`,
  );
  assert.equal(session.ok, true);
  if (!session.ok) return;
  assert.deepEqual(Object.keys(session.value._links), ["exchange-partner"]);
  assert.equal(buildPlaidWebExchangeSession("").ok, false);
});

test("dispatch does not call fetch when gates are closed", async () => {
  let called = 0;
  const result = await postSandboxTransfer({
    env: readDwollaEnv({}),
    accessToken: "token",
    idempotencyKey: "19051a62-3403-11e6-ac61-9e71128cae77",
    body: {
      _links: { source: { href: source }, destination: { href: destination } },
      amount: { currency: "USD", value: "10.50" },
      correlationId: "8a2cdc8d-629d-4a24-98ac-40b735229fe2",
    },
    fetchImpl: async () => {
      called += 1;
      return new Response(null, { status: 201 });
    },
  });
  assert.equal(result.ok, false);
  assert.equal(called, 0);
});

test("webhook signature is the raw body and a valid event still moves no money", async () => {
  const secret = "test-webhook-secret";
  const raw = JSON.stringify({
    id: "29a82d20-a703-41cb-9b3c-bd409c499925",
    topic: "customer_transfer_completed",
    resourceId: "a6f09251-c2de-4833-94a8-5c70916cebbc",
    creditJar: true,
    amount: { value: "20.00", currency: "USD" },
  });
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(await verifyDwollaSignature(raw, signature, secret), true);
  assert.equal(await verifyDwollaSignature(raw, signature, "other"), false);
  assert.equal(await verifyDwollaSignature(`${raw} `, signature, secret), false);
  const decision = await decideDwollaWebhook({ rawBody: raw, signature, secret });
  assert.equal(decision.verified, true);
  assert.equal(decision.applied, false);
  assert.equal(decision.fundsMoved, false);
  assert.equal(decision.jarCredited, false);
  assert.equal(decision.loanRepaid, false);
  const forged = await decideDwollaWebhook({ rawBody: raw, signature: "00", secret });
  assert.equal(forged.verified, false);
  assert.equal(forged.fundsMoved, false);
});

test("a client claim that funds moved is ignored", () => {
  const refused = assessWithdrawalPayload({
    fundsMoved: true,
    approved: true,
    actorUserId: "attacker",
    book: emptyBook(),
    withdrawalId: "missing",
  });
  assert.equal(refused.body.fundsMoved, false);
  assert.equal(refused.body.authoritative, false);
  const banned = assessWithdrawalPayload({ routingNumber: "021000021", book: emptyBook() });
  assert.equal(banned.status, 400);
  assert.equal(banned.body.fundsMoved, false);
});
