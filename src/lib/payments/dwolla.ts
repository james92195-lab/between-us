import { centsToDwollaValue } from "../money.ts";
import { err, ok, type Result } from "../result.ts";

export const DWOLLA_SANDBOX_ORIGIN = "https://api-sandbox.dwolla.com";
export const DWOLLA_PRODUCTION_ORIGIN = "https://api.dwolla.com";
export const HAL = "application/vnd.dwolla.v1.hal+json";
export const P2P_APPROVAL_VALUE = "written-approval-on-file";

export type DwollaEnv = {
  environment: string | undefined;
  clientId: string | undefined;
  clientSecret: string | undefined;
  webhookSecret: string | undefined;
  plaidExchangePartnerHref: string | undefined;
  p2pApproval: string | undefined;
  launchCountry: string | undefined;
  sandboxDispatch: string | undefined;
};

export function readDwollaEnv(source: Record<string, string | undefined>): DwollaEnv {
  const pick = (key: string) => source[key]?.trim() || undefined;
  return {
    environment: pick("DWOLLA_ENVIRONMENT"),
    clientId: pick("DWOLLA_CLIENT_ID"),
    clientSecret: pick("DWOLLA_CLIENT_SECRET"),
    webhookSecret: pick("DWOLLA_WEBHOOK_SECRET"),
    plaidExchangePartnerHref: pick("DWOLLA_PLAID_EXCHANGE_PARTNER_HREF"),
    p2pApproval: pick("DWOLLA_P2P_APPROVAL"),
    launchCountry: pick("DWOLLA_LAUNCH_COUNTRY"),
    sandboxDispatch: pick("DWOLLA_SANDBOX_DISPATCH"),
  };
}

export type PublicDwollaStatus = {
  provider: "dwolla";
  liveTransfers: false;
  jarPooling: false;
  sandboxDispatchArmed: boolean;
  fundsMoved: false;
  blockers: string[];
  credentialsPresent: {
    clientId: boolean;
    clientSecret: boolean;
    webhookSecret: boolean;
    plaidExchangePartnerHref: boolean;
  };
};

export function publicDwollaStatus(env: DwollaEnv): PublicDwollaStatus {
  const blockers = [
    "Dwolla’s user-to-user guide says peer-to-peer transfers need a risk review before you build. Between Us has no written approval.",
    "Launch country is not confirmed. Dwolla ACH in this integration is US-only.",
    "No Dwolla application, sandbox keys, or Plaid exchange-partner link is configured in this deployment.",
    "Standard bank-to-bank transfers are not a shared jar. Dwolla moves account-to-account funds through a Dwolla wallet. Pooling friend money needs a separate custody decision, and that product is not turned on.",
    "GitHub Pages cannot host the webhook or keep API secrets. A server with a private ledger and sign-in is still required.",
  ];
  return {
    provider: "dwolla",
    liveTransfers: false,
    jarPooling: false,
    sandboxDispatchArmed: loanDispatchAllowed(env).ok,
    fundsMoved: false,
    blockers,
    credentialsPresent: {
      clientId: Boolean(env.clientId),
      clientSecret: Boolean(env.clientSecret),
      webhookSecret: Boolean(env.webhookSecret),
      plaidExchangePartnerHref: Boolean(env.plaidExchangePartnerHref),
    },
  };
}

export function loanDispatchAllowed(env: DwollaEnv): Result<true> {
  if (env.p2pApproval !== P2P_APPROVAL_VALUE) {
    return err("p2p_review_required", "Dwolla has not approved this peer-to-peer use case.");
  }
  if (env.launchCountry !== "US") {
    return err("country_unconfirmed", "Dwolla ACH here is limited to a confirmed US launch.");
  }
  if (env.environment !== "sandbox") {
    return err("production_disabled", "Production transfers stay off.");
  }
  if (env.sandboxDispatch !== "enabled") {
    return err("dispatch_disabled", "Sandbox dispatch is not armed.");
  }
  if (!env.clientId || !env.clientSecret) {
    return err("missing_credentials", "Sandbox client id and secret are not set.");
  }
  return ok(true);
}

/** Shared-jar pooling is a different product from a user-to-user transfer. It stays off. */
export function jarDispatchAllowed(): Result<true> {
  return err(
    "jar_custody_not_approved",
    "Dwolla standard transfers are not an approved shared wallet for this jar. No pooled balance will be created.",
  );
}

export type TransferBody = {
  _links: { source: { href: string }; destination: { href: string } };
  amount: { currency: "USD"; value: string };
  correlationId: string;
};

function fundingSourceHref(href: string, origin: string): boolean {
  try {
    const url = new URL(href);
    return url.origin === origin && /^\/funding-sources\/[0-9a-f-]{36}$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function buildUserToUserTransfer(input: {
  amountCents: number;
  sourceFundingSourceHref: string;
  destinationFundingSourceHref: string;
  correlationId: string;
}): Result<TransferBody> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    return err("amount", "Amount has to be server-side cents.");
  }
  if (!fundingSourceHref(input.sourceFundingSourceHref, DWOLLA_SANDBOX_ORIGIN)) {
    return err("source", "Source must be a sandbox funding-source URL already stored on the server.");
  }
  if (!fundingSourceHref(input.destinationFundingSourceHref, DWOLLA_SANDBOX_ORIGIN)) {
    return err("destination", "Destination must be a sandbox funding-source URL already stored on the server.");
  }
  if (!/^[0-9a-f-]{36}$/i.test(input.correlationId)) {
    return err("correlation", "Correlation id must be a UUID minted by the server.");
  }
  return ok({
    _links: {
      source: { href: input.sourceFundingSourceHref },
      destination: { href: input.destinationFundingSourceHref },
    },
    amount: { currency: "USD", value: centsToDwollaValue(input.amountCents) },
    correlationId: input.correlationId,
  });
}

export function buildPlaidWebExchangeSession(partnerHref: string): Result<{ _links: { "exchange-partner": { href: string } } }> {
  if (!partnerHref) return err("missing_partner", "The Plaid exchange-partner URL is not configured.");
  let url: URL;
  try {
    url = new URL(partnerHref);
  } catch {
    return err("partner", "Exchange-partner href must be a Dwolla URL from GET /exchange-partners.");
  }
  if (url.origin !== DWOLLA_SANDBOX_ORIGIN && url.origin !== DWOLLA_PRODUCTION_ORIGIN) {
    return err("partner", "Exchange-partner href must be on Dwolla’s API host.");
  }
  if (!url.pathname.startsWith("/exchange-partners/")) {
    return err("partner", "Exchange-partner href must point at /exchange-partners/{id}.");
  }
  return ok({ _links: { "exchange-partner": { href: partnerHref } } });
}

export async function postSandboxTransfer(input: {
  env: DwollaEnv;
  accessToken: string;
  idempotencyKey: string;
  body: TransferBody;
  fetchImpl: typeof fetch;
}): Promise<Result<{ location: string | null; loanUpdated: false; jarUpdated: false }>> {
  const allowed = loanDispatchAllowed(input.env);
  if (!allowed.ok) return allowed;
  const response = await input.fetchImpl(`${DWOLLA_SANDBOX_ORIGIN}/transfers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: HAL,
      "Content-Type": HAL,
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify(input.body),
  });
  return ok({
    location: response.headers.get("location"),
    loanUpdated: false,
    jarUpdated: false,
  });
}

function xorHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

/** HMAC-SHA256 hex of the raw body, compared in constant time. Do not re-encode JSON. */
export async function verifyDwollaSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return xorHex(hex, signature.trim().toLowerCase());
}

export type WebhookDecision = {
  verified: boolean;
  applied: false;
  fundsMoved: false;
  jarCredited: false;
  loanRepaid: false;
  reason: string;
};

export async function decideDwollaWebhook(input: {
  rawBody: string;
  signature: string | null;
  secret: string | undefined;
}): Promise<WebhookDecision> {
  const verified = await verifyDwollaSignature(input.rawBody, input.signature, input.secret ?? "");
  if (!verified) {
    return {
      verified: false,
      applied: false,
      fundsMoved: false,
      jarCredited: false,
      loanRepaid: false,
      reason: "invalid_signature",
    };
  }
  return {
    verified: true,
    applied: false,
    fundsMoved: false,
    jarCredited: false,
    loanRepaid: false,
    reason: "no_server_ledger_and_jar_custody_not_approved",
  };
}
