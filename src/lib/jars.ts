import {
  pushAudit,
  type Approval,
  type Book,
  type Contribution,
  type ExecutionAttempt,
  type Jar,
  type JarMember,
  type WithdrawalRequest,
} from "./book.ts";
import { looksLikeBankNumber } from "./money.ts";
import { err, ok, type Result } from "./result.ts";

/** Fixed. A smaller circle does not lower this number. */
export const APPROVALS_REQUIRED = 3;

export type WithdrawalStanding = "pending" | "policy_approved" | "rejected" | "cancelled" | "blocked";

export function withdrawalBinding(request: Pick<
  WithdrawalRequest,
  "jarId" | "amountCents" | "currency" | "destinationPersonId" | "purpose" | "revision"
>): string {
  return [
    request.jarId,
    request.amountCents,
    request.currency,
    request.destinationPersonId,
    request.purpose,
    request.revision,
  ].join("|");
}

export function jarMembers(book: Book, jarId: string): JarMember[] {
  return book.members.filter((member) => member.jarId === jarId);
}

export function activeMemberIds(book: Book, jarId: string): string[] {
  return jarMembers(book, jarId)
    .filter((member) => member.status === "active")
    .map((member) => member.personId);
}

/** Active jar members except the requester. Circle membership alone is not enough. */
export function eligibleApproverIds(book: Book, request: Pick<WithdrawalRequest, "jarId" | "requesterId">): string[] {
  return activeMemberIds(book, request.jarId).filter((id) => id !== request.requesterId);
}

export function validApproverIds(book: Book, request: WithdrawalRequest): string[] {
  if (request.closed) return [];
  const binding = withdrawalBinding(request);
  const eligible = new Set(eligibleApproverIds(book, request));
  const ids = new Set<string>();
  for (const approval of request.approvals) {
    if (approval.decision !== "approve") continue;
    if (approval.binding !== binding) continue;
    if (approval.authority !== "device-record") continue;
    if (approval.personId === request.requesterId) continue;
    if (!eligible.has(approval.personId)) continue;
    ids.add(approval.personId);
  }
  return [...ids];
}

export function policyStanding(input: {
  closed: "rejected" | "cancelled" | null;
  eligibleCount: number;
  validYesCount: number;
  requesterActive: boolean;
}): WithdrawalStanding {
  if (input.closed === "rejected") return "rejected";
  if (input.closed === "cancelled") return "cancelled";
  if (!input.requesterActive || input.eligibleCount < APPROVALS_REQUIRED) return "blocked";
  if (input.validYesCount >= APPROVALS_REQUIRED) return "policy_approved";
  return "pending";
}

export function withdrawalStanding(book: Book, request: WithdrawalRequest): WithdrawalStanding {
  return policyStanding({
    closed: request.closed,
    eligibleCount: eligibleApproverIds(book, request).length,
    validYesCount: validApproverIds(book, request).length,
    requesterActive: activeMemberIds(book, request.jarId).includes(request.requesterId),
  });
}

export function recordedCents(book: Book, jarId: string): number {
  return book.contributions
    .filter((row) => row.jarId === jarId && row.source === "recorded")
    .reduce((sum, row) => sum + row.amountCents, 0);
}

/**
 * Provider-confirmed cents only. Recorded promises are not included.
 * This version has no path that writes provider rows, so this stays 0 in the app.
 */
export function confirmedCents(book: Book, jarId: string): number {
  return book.contributions
    .filter((row) => row.jarId === jarId && (row.source as string) === "provider")
    .reduce((sum, row) => sum + row.amountCents, 0);
}

function audit(
  book: Book,
  input: { id: string; at: number; jarId: string | null; kind: string; summary: string },
): Book {
  return pushAudit(book, input);
}

export function createJar(
  book: Book,
  input: { id: string; name: string; goalCents: number; at: number; keeperId: string },
): Result<Book> {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!name) return err("name", "Name the jar.");
  if (!Number.isSafeInteger(input.goalCents) || input.goalCents <= 0) {
    return err("goal", "Set a goal like 50.00.");
  }
  if (!book.people.some((person) => person.id === input.keeperId)) {
    return err("unknown_person", "The circle doesn’t include that person.");
  }
  const jar: Jar = {
    id: input.id,
    name,
    goalCents: input.goalCents,
    currency: "USD",
    createdAt: input.at,
    custody: "undecided",
    withdrawalRule: "three-other-active-members",
  };
  const member: JarMember = {
    jarId: jar.id,
    personId: input.keeperId,
    status: "active",
    joinedAt: input.at,
  };
  const next = audit(
    { ...book, jars: [...book.jars, jar], members: [...book.members, member] },
    {
      id: `${input.id}-audit`,
      at: input.at,
      jarId: jar.id,
      kind: "jar.created",
      summary: `Jar “${name}” opened. Custody is undecided. Withdrawals need ${APPROVALS_REQUIRED} other active members.`,
    },
  );
  return ok(next);
}

export function setJarGoal(book: Book, input: { jarId: string; goalCents: number; at: number; auditId: string }): Result<Book> {
  const jar = book.jars.find((row) => row.id === input.jarId);
  if (!jar) return err("missing_jar", "That jar isn’t in the book.");
  if (!Number.isSafeInteger(input.goalCents) || input.goalCents <= 0) {
    return err("goal", "Set a goal like 50.00.");
  }
  return ok(
    audit(
      {
        ...book,
        jars: book.jars.map((row) => (row.id === jar.id ? { ...row, goalCents: input.goalCents } : row)),
      },
      {
        id: input.auditId,
        at: input.at,
        jarId: jar.id,
        kind: "jar.goal",
        summary: "Goal updated. The goal is a target for the record, not a bank balance.",
      },
    ),
  );
}

export function addJarMember(
  book: Book,
  input: { jarId: string; personId: string; at: number; auditId: string },
): Result<Book> {
  const jar = book.jars.find((row) => row.id === input.jarId);
  if (!jar) return err("missing_jar", "That jar isn’t in the book.");
  if (!book.people.some((person) => person.id === input.personId)) {
    return err("unknown_person", "Add them to the circle first.");
  }
  const existing = book.members.find((member) => member.jarId === input.jarId && member.personId === input.personId);
  if (existing?.status === "active") return ok(book);
  const members = existing
    ? book.members.map((member) =>
        member.jarId === input.jarId && member.personId === input.personId
          ? { ...member, status: "active" as const }
          : member,
      )
    : [...book.members, { jarId: input.jarId, personId: input.personId, status: "active" as const, joinedAt: input.at }];
  return ok(
    audit(
      { ...book, members },
      {
        id: input.auditId,
        at: input.at,
        jarId: input.jarId,
        kind: "jar.member",
        summary: "An active member joined this jar. Joining does not grant a withdrawal by itself.",
      },
    ),
  );
}

export function setMemberStatus(
  book: Book,
  input: { jarId: string; personId: string; status: "active" | "inactive"; at: number; auditId: string },
): Result<Book> {
  const member = book.members.find((row) => row.jarId === input.jarId && row.personId === input.personId);
  if (!member) return err("missing_member", "That person isn’t in this jar.");
  if (member.status === input.status) return ok(book);
  return ok(
    audit(
      {
        ...book,
        members: book.members.map((row) =>
          row.jarId === input.jarId && row.personId === input.personId ? { ...row, status: input.status } : row,
        ),
      },
      {
        id: input.auditId,
        at: input.at,
        jarId: input.jarId,
        kind: "jar.member",
        summary:
          input.status === "inactive"
            ? "Member marked inactive. Their earlier yes no longer counts, and the threshold stays at 3."
            : "Member marked active again. Old votes are not restored.",
      },
    ),
  );
}

export function recordContribution(
  book: Book,
  input: { id: string; jarId: string; personId: string; amountCents: number; note: string; at: number },
): Result<Book> {
  if (!book.jars.some((jar) => jar.id === input.jarId)) return err("missing_jar", "That jar isn’t in the book.");
  const member = book.members.find((row) => row.jarId === input.jarId && row.personId === input.personId);
  if (!member || member.status !== "active") {
    return err("not_member", "Only an active member of this jar can be written down for a contribution.");
  }
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    return err("amount", "Enter an amount like 5.00.");
  }
  const note = input.note.trim().slice(0, 120) || "Recorded";
  if (looksLikeBankNumber(note)) {
    return err("bank_details", "Don’t put account or routing numbers in the book.");
  }
  const row: Contribution = {
    id: input.id,
    jarId: input.jarId,
    personId: input.personId,
    amountCents: input.amountCents,
    currency: "USD",
    at: input.at,
    note,
    source: "recorded",
  };
  return ok(
    audit(
      { ...book, contributions: [...book.contributions, row] },
      {
        id: `${input.id}-audit`,
        at: input.at,
        jarId: input.jarId,
        kind: "jar.contribution",
        summary: "Recorded a promised contribution. This is not money received and cannot be spent.",
      },
    ),
  );
}

export function createWithdrawal(
  book: Book,
  input: {
    id: string;
    jarId: string;
    requesterId: string;
    amountCents: number;
    destinationPersonId: string;
    purpose: string;
    at: number;
  },
): Result<Book> {
  const jar = book.jars.find((row) => row.id === input.jarId);
  if (!jar) return err("missing_jar", "That jar isn’t in the book.");
  const requester = book.members.find((row) => row.jarId === jar.id && row.personId === input.requesterId);
  if (!requester || requester.status !== "active") {
    return err("not_member", "The requester has to be an active member of this jar.");
  }
  if (!book.people.some((person) => person.id === input.destinationPersonId)) {
    return err("unknown_person", "Pick a destination who is in the circle.");
  }
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    return err("amount", "Enter an amount like 20.00.");
  }
  const purpose = input.purpose.trim().slice(0, 120);
  if (!purpose) return err("purpose", "Say what the withdrawal is for.");
  if (looksLikeBankNumber(purpose)) {
    return err("bank_details", "Don’t put account or routing numbers in the book.");
  }
  const request: WithdrawalRequest = {
    id: input.id,
    jarId: jar.id,
    requesterId: input.requesterId,
    amountCents: input.amountCents,
    currency: "USD",
    destinationPersonId: input.destinationPersonId,
    purpose,
    revision: 1,
    createdAt: input.at,
    updatedAt: input.at,
    approvals: [],
    closed: null,
    executionAttempts: [],
  };
  const standing = withdrawalStanding(book, request);
  return ok(
    audit(
      { ...book, withdrawals: [...book.withdrawals, request] },
      {
        id: `${input.id}-audit`,
        at: input.at,
        jarId: jar.id,
        kind: "withdrawal.created",
        summary:
          standing === "blocked"
            ? `Withdrawal requested. Fewer than ${APPROVALS_REQUIRED} other active members can vote, so approval is blocked. The threshold stays ${APPROVALS_REQUIRED}.`
            : `Withdrawal requested. It needs ${APPROVALS_REQUIRED} other active members. A yes is not a transfer.`,
      },
    ),
  );
}

function replaceWithdrawal(book: Book, request: WithdrawalRequest): Book {
  return {
    ...book,
    withdrawals: book.withdrawals.map((row) => (row.id === request.id ? request : row)),
  };
}

export function editWithdrawal(
  book: Book,
  input: {
    withdrawalId: string;
    amountCents: number;
    destinationPersonId: string;
    purpose: string;
    at: number;
    auditId: string;
  },
): Result<Book> {
  const request = book.withdrawals.find((row) => row.id === input.withdrawalId);
  if (!request) return err("missing_withdrawal", "That request isn’t in the book.");
  if (request.closed) return err("closed", "This request is closed. Start a new one.");
  if (!book.people.some((person) => person.id === input.destinationPersonId)) {
    return err("unknown_person", "Pick a destination who is in the circle.");
  }
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    return err("amount", "Enter an amount like 20.00.");
  }
  const purpose = input.purpose.trim().slice(0, 120);
  if (!purpose) return err("purpose", "Say what the withdrawal is for.");
  if (looksLikeBankNumber(purpose)) return err("bank_details", "Don’t put account or routing numbers in the book.");
  const same =
    request.amountCents === input.amountCents &&
    request.destinationPersonId === input.destinationPersonId &&
    request.purpose === purpose;
  if (same) return ok(book);
  const next: WithdrawalRequest = {
    ...request,
    amountCents: input.amountCents,
    destinationPersonId: input.destinationPersonId,
    purpose,
    revision: request.revision + 1,
    updatedAt: input.at,
  };
  return ok(
    audit(replaceWithdrawal(book, next), {
      id: input.auditId,
      at: input.at,
      jarId: request.jarId,
      kind: "withdrawal.edited",
      summary: "The amount, destination, or purpose changed. Earlier approvals no longer count.",
    }),
  );
}

export function approveWithdrawal(
  book: Book,
  input: { withdrawalId: string; personId: string; at: number; auditId: string },
): Result<Book> {
  const request = book.withdrawals.find((row) => row.id === input.withdrawalId);
  if (!request) return err("missing_withdrawal", "That request isn’t in the book.");
  if (request.closed) return err("closed", "This request is closed.");
  if (input.personId === request.requesterId) {
    return err("self_approval", "The requester can’t approve their own withdrawal.");
  }
  const eligible = eligibleApproverIds(book, request);
  if (eligible.length < APPROVALS_REQUIRED) {
    return err(
      "need_three_others",
      `Approval needs ${APPROVALS_REQUIRED} other active members. This jar has ${eligible.length}. The threshold stays ${APPROVALS_REQUIRED}.`,
    );
  }
  if (!eligible.includes(input.personId)) {
    return err("not_eligible", "Only another active member of this jar can approve.");
  }
  const binding = withdrawalBinding(request);
  const existing = request.approvals.find((row) => row.personId === input.personId && row.binding === binding);
  if (existing?.decision === "approve") return ok(book);
  if (existing?.decision === "reject") {
    return err("duplicate_decision", "This person already recorded a decision for this version.");
  }
  const approval: Approval = {
    personId: input.personId,
    decision: "approve",
    binding,
    at: input.at,
    authority: "device-record",
  };
  const next: WithdrawalRequest = {
    ...request,
    approvals: [...request.approvals, approval],
    updatedAt: input.at,
  };
  const standing = withdrawalStanding(book, next);
  return ok(
    audit(replaceWithdrawal(book, next), {
      id: input.auditId,
      at: input.at,
      jarId: request.jarId,
      kind: "withdrawal.approval",
      summary:
        standing === "policy_approved"
          ? `Recorded a yes. ${APPROVALS_REQUIRED} distinct other members have now approved this version. Money has not moved.`
          : "Recorded a yes on this device. It is not a signed-in authorization and it does not send money.",
    }),
  );
}

export function rejectWithdrawal(
  book: Book,
  input: { withdrawalId: string; personId: string; at: number; auditId: string },
): Result<Book> {
  const request = book.withdrawals.find((row) => row.id === input.withdrawalId);
  if (!request) return err("missing_withdrawal", "That request isn’t in the book.");
  if (request.closed === "rejected") return ok(book);
  if (request.closed === "cancelled") return err("closed", "The requester already cancelled this.");
  if (input.personId === request.requesterId) {
    return err("self_approval", "The requester can cancel, not reject, their own request.");
  }
  const eligible = new Set(activeMemberIds(book, request.jarId));
  eligible.delete(request.requesterId);
  if (!eligible.has(input.personId)) {
    return err("not_eligible", "Only another active member of this jar can reject.");
  }
  const binding = withdrawalBinding(request);
  const existing = request.approvals.find((row) => row.personId === input.personId && row.binding === binding);
  if (existing?.decision === "approve") {
    return err("duplicate_decision", "This person already approved this version.");
  }
  const approval: Approval = {
    personId: input.personId,
    decision: "reject",
    binding,
    at: input.at,
    authority: "device-record",
  };
  const next: WithdrawalRequest = {
    ...request,
    closed: "rejected",
    approvals: existing ? request.approvals : [...request.approvals, approval],
    updatedAt: input.at,
  };
  return ok(
    audit(replaceWithdrawal(book, next), {
      id: input.auditId,
      at: input.at,
      jarId: request.jarId,
      kind: "withdrawal.rejected",
      summary: "An eligible member rejected this version. It cannot be sent.",
    }),
  );
}

export function cancelWithdrawal(
  book: Book,
  input: { withdrawalId: string; personId: string; at: number; auditId: string },
): Result<Book> {
  const request = book.withdrawals.find((row) => row.id === input.withdrawalId);
  if (!request) return err("missing_withdrawal", "That request isn’t in the book.");
  if (request.closed === "cancelled") return ok(book);
  if (request.closed === "rejected") return err("closed", "This request was already rejected.");
  if (input.personId !== request.requesterId) {
    return err("not_requester", "Only the requester can cancel.");
  }
  const next: WithdrawalRequest = { ...request, closed: "cancelled", updatedAt: input.at };
  return ok(
    audit(replaceWithdrawal(book, next), {
      id: input.auditId,
      at: input.at,
      jarId: request.jarId,
      kind: "withdrawal.cancelled",
      summary: "The requester cancelled this withdrawal.",
    }),
  );
}

export type ExecutionDecision = {
  fundsMoved: false;
  policyApproved: boolean;
  reasons: string[];
  authoritative: false;
};

export function executionReasons(book: Book, request: WithdrawalRequest): string[] {
  const reasons: string[] = [];
  const standing = withdrawalStanding(book, request);
  if (standing !== "policy_approved") {
    reasons.push(
      standing === "blocked"
        ? `need_${APPROVALS_REQUIRED}_other_active_members`
        : `not_policy_approved:${standing}`,
    );
  }
  const confirmed = confirmedCents(book, request.jarId);
  if (confirmed < request.amountCents) reasons.push("insufficient_confirmed_funds");
  reasons.push("jar_custody_not_approved");
  reasons.push("transfers_disabled");
  return reasons;
}

/**
 * Records an attempt and never moves money. Same idempotency key returns the same book.
 * Confirmed funds are not reduced.
 */
export function attemptWithdrawalExecution(
  book: Book,
  input: { withdrawalId: string; idempotencyKey: string; at: number; auditId: string },
): Result<Book> {
  const request = book.withdrawals.find((row) => row.id === input.withdrawalId);
  if (!request) return err("missing_withdrawal", "That request isn’t in the book.");
  const key = input.idempotencyKey.trim();
  if (!key || key.length > 80) return err("idempotency", "Use an idempotency key.");
  if (request.executionAttempts.some((attempt) => attempt.idempotencyKey === key)) return ok(book);
  const reasons = executionReasons(book, request);
  const attempt: ExecutionAttempt = {
    idempotencyKey: key,
    at: input.at,
    fundsMoved: false,
    policyApproved: withdrawalStanding(book, request) === "policy_approved",
    reasons,
  };
  const next: WithdrawalRequest = {
    ...request,
    executionAttempts: [...request.executionAttempts, attempt],
    updatedAt: input.at,
  };
  return ok(
    audit(replaceWithdrawal(book, next), {
      id: input.auditId,
      at: input.at,
      jarId: request.jarId,
      kind: "withdrawal.execution",
      summary: "Checked sending this withdrawal. No transfer was created. Confirmed funds were not reduced.",
    }),
  );
}

export function executionDecision(book: Book, withdrawalId: string): ExecutionDecision | null {
  const request = book.withdrawals.find((row) => row.id === withdrawalId);
  if (!request) return null;
  const reasons = executionReasons(book, request);
  return {
    fundsMoved: false,
    policyApproved: !reasons.some((reason) => reason.startsWith("not_policy_approved") || reason.startsWith("need_")),
    reasons,
    authoritative: false,
  };
}

/**
 * Fold two concurrent copies of the same request.
 * A rejection wins over an approval. A higher revision drops approvals for the older binding.
 * Execution attempts union by idempotency key. Nothing in the merge sets fundsMoved.
 */
export function mergeWithdrawal(left: WithdrawalRequest, right: WithdrawalRequest): WithdrawalRequest {
  if (left.id !== right.id || left.jarId !== right.jarId) {
    throw new Error("Can only merge the same withdrawal.");
  }
  const newer = left.revision >= right.revision ? left : right;
  const older = newer === left ? right : left;
  const revisionChanged = left.revision !== right.revision;
  const binding = withdrawalBinding(newer);
  const approvals: Approval[] = [];
  const seen = new Set<string>();
  const pool = revisionChanged ? newer.approvals : [...older.approvals, ...newer.approvals];
  for (const approval of pool) {
    if (approval.binding !== binding) continue;
    const key = `${approval.personId}|${approval.binding}`;
    if (seen.has(key)) continue;
    seen.add(key);
    approvals.push(approval);
  }
  let closed = newer.closed;
  if (left.closed === "rejected" || right.closed === "rejected") closed = "rejected";
  else if (left.closed === "cancelled" || right.closed === "cancelled") closed = "cancelled";
  const attempts: ExecutionAttempt[] = [];
  const attemptKeys = new Set<string>();
  for (const attempt of [...left.executionAttempts, ...right.executionAttempts]) {
    if (attemptKeys.has(attempt.idempotencyKey)) continue;
    attemptKeys.add(attempt.idempotencyKey);
    attempts.push({ ...attempt, fundsMoved: false });
  }
  return {
    ...newer,
    closed,
    approvals,
    executionAttempts: attempts,
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
  };
}

export function standingLabel(standing: WithdrawalStanding): string {
  if (standing === "policy_approved") return "Policy approved";
  if (standing === "pending") return "Pending";
  if (standing === "rejected") return "Rejected";
  if (standing === "cancelled") return "Cancelled";
  return "Blocked";
}
