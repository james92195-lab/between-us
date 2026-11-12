import { parseBook } from "../book.ts";
import { executionDecision } from "../jars.ts";
import { publicDwollaStatus, readDwollaEnv, type DwollaEnv } from "./dwolla.ts";

const BANNED = ["routingnumber", "accountnumber", "cardnumber", "cvc", "cvv", "ssn", "password", "iban"];

function hasBannedKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (BANNED.includes(key.toLowerCase())) return true;
    if (hasBannedKey(child)) return true;
  }
  return false;
}

export function assessWithdrawalPayload(payload: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (hasBannedKey(payload)) {
    return {
      status: 400,
      body: {
        fundsMoved: false,
        authoritative: false,
        error: "Bank, card, and tax identifiers are not accepted.",
      },
    };
  }
  const bookRaw = payload && typeof payload === "object" && "book" in payload ? payload.book : payload;
  const parsed = parseBook(bookRaw);
  if (!parsed.ok) {
    return { status: 400, body: { fundsMoved: false, authoritative: false, error: parsed.error } };
  }
  const withdrawalId =
    payload && typeof payload === "object" && "withdrawalId" in payload && typeof payload.withdrawalId === "string"
      ? payload.withdrawalId
      : "";
  const decision = executionDecision(parsed.value, withdrawalId);
  if (!decision) {
    return {
      status: 404,
      body: { fundsMoved: false, authoritative: false, error: "That withdrawal isn’t in the submitted book." },
    };
  }
  return {
    status: 403,
    body: {
      fundsMoved: false,
      authoritative: false,
      authorization: "no-authenticated-membership-ledger",
      policyApproved: decision.policyApproved,
      reasons: decision.reasons,
      note: "Votes stored on a device are not signed-in approvals, and this server will not send a transfer.",
    },
  };
}

export function paymentStatusBody(env: DwollaEnv = readDwollaEnv(process.env)): Record<string, unknown> {
  return publicDwollaStatus(env);
}
