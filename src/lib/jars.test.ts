import assert from "node:assert/strict";
import test from "node:test";
import { emptyBook, parseBook, type Book, type Contribution, type WithdrawalRequest } from "./book.ts";
import {
  APPROVALS_REQUIRED,
  addJarMember,
  approveWithdrawal,
  attemptWithdrawalExecution,
  cancelWithdrawal,
  confirmedCents,
  createJar,
  createWithdrawal,
  editWithdrawal,
  eligibleApproverIds,
  mergeWithdrawal,
  recordContribution,
  recordedCents,
  rejectWithdrawal,
  setMemberStatus,
  validApproverIds,
  withdrawalStanding,
} from "./jars.ts";
import { addPerson } from "./loans.ts";

function must<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function withFriends(): Book {
  let book = emptyBook();
  for (const [id, name] of [
    ["maya", "Maya"],
    ["jonah", "Jonah"],
    ["priya", "Priya"],
  ] as const) {
    book = must(addPerson(book, { id, name, note: "" }));
  }
  return book;
}

function openedJar(book = withFriends()): Book {
  return must(createJar(book, { id: "jar-1", name: "Friday jar", goalCents: 5000, at: 1, keeperId: "you" }));
}

function fullMembers(book = openedJar()): Book {
  book = must(addJarMember(book, { jarId: "jar-1", personId: "maya", at: 2, auditId: "a1" }));
  book = must(addJarMember(book, { jarId: "jar-1", personId: "jonah", at: 3, auditId: "a2" }));
  book = must(addJarMember(book, { jarId: "jar-1", personId: "priya", at: 4, auditId: "a3" }));
  return book;
}

function requestFromYou(book = fullMembers()): Book {
  return must(
    createWithdrawal(book, {
      id: "w1",
      jarId: "jar-1",
      requesterId: "you",
      amountCents: 2000,
      destinationPersonId: "maya",
      purpose: "Groceries",
      at: 10,
    }),
  );
}

function approveAs(book: Book, personId: string, n: number): Book {
  return must(approveWithdrawal(book, { withdrawalId: "w1", personId, at: 20 + n, auditId: `yes-${personId}` }));
}

test("threshold stays 3 when the circle is smaller", () => {
  assert.equal(APPROVALS_REQUIRED, 3);
  let book = openedJar();
  book = must(addJarMember(book, { jarId: "jar-1", personId: "maya", at: 2, auditId: "m" }));
  book = must(
    createWithdrawal(book, {
      id: "w1",
      jarId: "jar-1",
      requesterId: "you",
      amountCents: 100,
      destinationPersonId: "maya",
      purpose: "Tea",
      at: 3,
    }),
  );
  assert.equal(eligibleApproverIds(book, book.withdrawals[0]).length, 1);
  assert.equal(withdrawalStanding(book, book.withdrawals[0]), "blocked");
  const vote = approveWithdrawal(book, { withdrawalId: "w1", personId: "maya", at: 4, auditId: "nope" });
  assert.equal(vote.ok, false);
  if (vote.ok) return;
  assert.equal(vote.code, "need_three_others");
  assert.match(vote.error, /stays 3/);
  assert.equal(book.withdrawals[0].approvals.length, 0);
});

test("three people including the requester do not meet the threshold", () => {
  let book = openedJar();
  book = must(addJarMember(book, { jarId: "jar-1", personId: "maya", at: 2, auditId: "m" }));
  book = must(addJarMember(book, { jarId: "jar-1", personId: "jonah", at: 3, auditId: "j" }));
  assert.equal(activeCount(book), 3);
  book = must(
    createWithdrawal(book, {
      id: "w1",
      jarId: "jar-1",
      requesterId: "you",
      amountCents: 100,
      destinationPersonId: "maya",
      purpose: "Tea",
      at: 4,
    }),
  );
  assert.equal(eligibleApproverIds(book, book.withdrawals[0]).length, 2);
  assert.equal(withdrawalStanding(book, book.withdrawals[0]), "blocked");
});

function activeCount(book: Book): number {
  return book.members.filter((member) => member.jarId === "jar-1" && member.status === "active").length;
}

test("requester cannot approve, and the same person cannot vote twice", () => {
  let book = requestFromYou();
  const self = approveWithdrawal(book, { withdrawalId: "w1", personId: "you", at: 1, auditId: "self" });
  assert.equal(self.ok, false);
  if (self.ok) return;
  assert.equal(self.code, "self_approval");
  book = approveAs(book, "maya", 1);
  const again = approveWithdrawal(book, { withdrawalId: "w1", personId: "maya", at: 99, auditId: "dup" });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.value.withdrawals[0].approvals.length, 1);
  assert.equal(validApproverIds(again.value, again.value.withdrawals[0]).length, 1);
});

test("three distinct other members reach policy approved, which is not a payment", () => {
  let book = requestFromYou();
  book = approveAs(book, "maya", 1);
  book = approveAs(book, "jonah", 2);
  assert.equal(withdrawalStanding(book, book.withdrawals[0]), "pending");
  book = approveAs(book, "priya", 3);
  const request = book.withdrawals[0];
  assert.equal(withdrawalStanding(book, request), "policy_approved");
  assert.equal(request.approvals.every((row) => row.authority === "device-record"), true);
  const checked = must(
    attemptWithdrawalExecution(book, { withdrawalId: "w1", idempotencyKey: "exec-1", at: 50, auditId: "ex" }),
  );
  const attempt = checked.withdrawals[0].executionAttempts[0];
  assert.equal(attempt.fundsMoved, false);
  assert.equal(attempt.policyApproved, true);
  assert.ok(attempt.reasons.includes("transfers_disabled"));
  assert.ok(attempt.reasons.includes("insufficient_confirmed_funds"));
  assert.ok(attempt.reasons.includes("jar_custody_not_approved"));
  assert.equal(confirmedCents(checked, "jar-1"), 0);
});

test("recorded contributions are not confirmed spendable funds", () => {
  let book = requestFromYou();
  book = must(
    recordContribution(book, { id: "c1", jarId: "jar-1", personId: "maya", amountCents: 9000, note: "Promise", at: 5 }),
  );
  assert.equal(recordedCents(book, "jar-1"), 9000);
  assert.equal(confirmedCents(book, "jar-1"), 0);
  book = approveAs(book, "maya", 1);
  book = approveAs(book, "jonah", 2);
  book = approveAs(book, "priya", 3);
  const checked = must(
    attemptWithdrawalExecution(book, { withdrawalId: "w1", idempotencyKey: "exec-1", at: 50, auditId: "ex" }),
  );
  assert.ok(checked.withdrawals[0].executionAttempts[0].reasons.includes("insufficient_confirmed_funds"));
  assert.equal(confirmedCents(checked, "jar-1"), 0);
});

test("a hand-built confirmed row still does not send, and is not reduced twice", () => {
  let book = requestFromYou();
  book = approveAs(book, "maya", 1);
  book = approveAs(book, "jonah", 2);
  book = approveAs(book, "priya", 3);
  const phantom: Contribution = {
    id: "prov",
    jarId: "jar-1",
    personId: "maya",
    amountCents: 5000,
    currency: "USD",
    at: 1,
    note: "not from the app",
    source: "recorded",
  };
  const credited = {
    ...book,
    contributions: [...book.contributions, { ...phantom, source: "provider" }],
  } as Book;
  assert.equal(confirmedCents(credited, "jar-1"), 5000);
  const once = must(
    attemptWithdrawalExecution(credited, { withdrawalId: "w1", idempotencyKey: "exec-1", at: 50, auditId: "ex" }),
  );
  assert.equal(once.withdrawals[0].executionAttempts[0].reasons.includes("insufficient_confirmed_funds"), false);
  assert.ok(once.withdrawals[0].executionAttempts[0].reasons.includes("transfers_disabled"));
  assert.equal(once.withdrawals[0].executionAttempts[0].fundsMoved, false);
  assert.equal(confirmedCents(once, "jar-1"), 5000);
  const twice = must(
    attemptWithdrawalExecution(once, { withdrawalId: "w1", idempotencyKey: "exec-1", at: 60, auditId: "ex2" }),
  );
  assert.equal(twice, once);
  assert.equal(twice.withdrawals[0].executionAttempts.length, 1);
});

test("editing amount, destination, or purpose invalidates approvals", () => {
  let book = requestFromYou();
  book = approveAs(book, "maya", 1);
  book = approveAs(book, "jonah", 2);
  const oldBinding = book.withdrawals[0].approvals[0].binding;
  book = must(
    editWithdrawal(book, {
      withdrawalId: "w1",
      amountCents: 2500,
      destinationPersonId: "jonah",
      purpose: "Groceries",
      at: 30,
      auditId: "edit",
    }),
  );
  const request = book.withdrawals[0];
  assert.equal(request.revision, 2);
  assert.notEqual(request.approvals[0].binding, withdrawalBindingOf(request));
  assert.equal(request.approvals[0].binding, oldBinding);
  assert.equal(validApproverIds(book, request).length, 0);
  assert.equal(withdrawalStanding(book, request), "pending");
  const replay = approveWithdrawal(book, { withdrawalId: "w1", personId: "maya", at: 31, auditId: "fresh" });
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(validApproverIds(replay.value, replay.value.withdrawals[0]).length, 1);
});

function withdrawalBindingOf(request: WithdrawalRequest): string {
  return [
    request.jarId,
    request.amountCents,
    request.currency,
    request.destinationPersonId,
    request.purpose,
    request.revision,
  ].join("|");
}

test("deactivating an approver drops policy approval and does not lower the threshold", () => {
  let book = requestFromYou();
  book = approveAs(book, "maya", 1);
  book = approveAs(book, "jonah", 2);
  book = approveAs(book, "priya", 3);
  assert.equal(withdrawalStanding(book, book.withdrawals[0]), "policy_approved");
  book = must(setMemberStatus(book, { jarId: "jar-1", personId: "priya", status: "inactive", at: 40, auditId: "off" }));
  assert.equal(eligibleApproverIds(book, book.withdrawals[0]).length, 2);
  assert.equal(withdrawalStanding(book, book.withdrawals[0]), "blocked");
  const another = approveWithdrawal(book, { withdrawalId: "w1", personId: "maya", at: 41, auditId: "again" });
  assert.equal(another.ok, false);
  if (another.ok) return;
  assert.equal(another.code, "need_three_others");
});

test("requester leaving the jar blocks a request that already has three yeses", () => {
  let book = requestFromYou();
  book = approveAs(book, "maya", 1);
  book = approveAs(book, "jonah", 2);
  book = approveAs(book, "priya", 3);
  book = must(setMemberStatus(book, { jarId: "jar-1", personId: "you", status: "inactive", at: 40, auditId: "off" }));
  assert.equal(withdrawalStanding(book, book.withdrawals[0]), "blocked");
  const checked = must(
    attemptWithdrawalExecution(book, { withdrawalId: "w1", idempotencyKey: "exec-leave", at: 41, auditId: "ex" }),
  );
  assert.equal(checked.withdrawals[0].executionAttempts[0].policyApproved, false);
  assert.equal(checked.withdrawals[0].executionAttempts[0].fundsMoved, false);
});

test("stuffed duplicate approver ids still count once", () => {
  const book = requestFromYou();
  const request = book.withdrawals[0];
  const binding = withdrawalBindingOf(request);
  const stuffed: WithdrawalRequest = {
    ...request,
    approvals: [1, 2, 3].map((at) => ({
      personId: "maya",
      decision: "approve" as const,
      binding,
      at,
      authority: "device-record" as const,
    })),
  };
  const next = { ...book, withdrawals: [stuffed] };
  assert.equal(validApproverIds(next, stuffed).length, 1);
  assert.equal(withdrawalStanding(next, stuffed), "pending");
});

test("concurrent approvals merge without double counting, and a reject wins", () => {
  const base = requestFromYou();
  const left = approveAs(base, "maya", 1);
  const right = approveAs(base, "jonah", 2);
  const mergedRequest = mergeWithdrawal(left.withdrawals[0], right.withdrawals[0]);
  let merged = { ...base, withdrawals: [mergedRequest] };
  assert.equal(validApproverIds(merged, merged.withdrawals[0]).length, 2);
  const withPriya = approveAs(merged, "priya", 3);
  assert.equal(withdrawalStanding(withPriya, withPriya.withdrawals[0]), "policy_approved");
  const rejection = must(rejectWithdrawal(base, { withdrawalId: "w1", personId: "priya", at: 80, auditId: "no" }));
  const raced = mergeWithdrawal(withPriya.withdrawals[0], rejection.withdrawals[0]);
  const racedBook = { ...base, withdrawals: [raced] };
  assert.equal(withdrawalStanding(racedBook, raced), "rejected");
});

test("an edit racing an approval keeps the new version and drops the old yes", () => {
  const base = requestFromYou();
  const approved = approveAs(base, "maya", 1);
  const edited = must(
    editWithdrawal(base, {
      withdrawalId: "w1",
      amountCents: 3000,
      destinationPersonId: "maya",
      purpose: "Rent",
      at: 40,
      auditId: "edit",
    }),
  );
  const raced = mergeWithdrawal(approved.withdrawals[0], edited.withdrawals[0]);
  const book = { ...base, withdrawals: [raced] };
  assert.equal(raced.revision, 2);
  assert.equal(raced.amountCents, 3000);
  assert.equal(validApproverIds(book, raced).length, 0);
  assert.equal(withdrawalStanding(book, raced), "pending");
});

test("cancel is requester-only and idempotent", () => {
  const book = requestFromYou();
  const stranger = cancelWithdrawal(book, { withdrawalId: "w1", personId: "maya", at: 1, auditId: "c" });
  assert.equal(stranger.ok, false);
  const once = must(cancelWithdrawal(book, { withdrawalId: "w1", personId: "you", at: 2, auditId: "c1" }));
  const twice = must(cancelWithdrawal(once, { withdrawalId: "w1", personId: "you", at: 3, auditId: "c2" }));
  assert.equal(withdrawalStanding(twice, twice.withdrawals[0]), "cancelled");
  assert.equal(twice.audit.filter((event) => event.kind === "withdrawal.cancelled").length, 1);
});

test("imported books cannot claim a provider already confirmed jar money", () => {
  const book = requestFromYou();
  const lied = {
    ...book,
    contributions: [
      {
        id: "c",
        jarId: "jar-1",
        personId: "maya",
        amountCents: 100,
        currency: "USD",
        at: 1,
        note: "paid",
        source: "provider",
      },
    ],
  };
  const parsed = parseBook(lied);
  assert.equal(parsed.ok, false);
});

test("audit trail records the policy steps", () => {
  let book = requestFromYou();
  book = approveAs(book, "maya", 1);
  const kinds = book.audit.map((event) => event.kind);
  assert.ok(kinds.includes("jar.created"));
  assert.ok(kinds.includes("withdrawal.created"));
  assert.ok(kinds.includes("withdrawal.approval"));
});
