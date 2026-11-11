import { APPROVALS_REQUIRED, policyStanding, withdrawalBinding } from "../jars.ts";
import { err, ok, type Result } from "../result.ts";

export type Queryable = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export type BookDb = Queryable & {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
};

type MemberRow = { user_id: string; status: string; name: string; email: string };
type WithdrawalRow = {
  id: string;
  jar_id: string;
  circle_id: string;
  requester_id: string;
  amount_cents: number;
  currency: string;
  destination_user_id: string;
  purpose: string;
  revision: number;
  closed: "rejected" | "cancelled" | null;
};

function id(): string {
  return crypto.randomUUID();
}

async function one<T>(tx: Queryable, text: string, params: unknown[]): Promise<T | null> {
  const rows = await tx.query<T>(text, params);
  return rows[0] ?? null;
}

async function circleRole(tx: Queryable, circleId: string, userId: string): Promise<string | null> {
  const row = await one<{ status: string }>(
    tx,
    "select status from circle_members where circle_id = $1 and user_id = $2",
    [circleId, userId],
  );
  return row?.status ?? null;
}

async function requireActiveCircle(tx: Queryable, circleId: string, userId: string): Promise<Result<true>> {
  const status = await circleRole(tx, circleId, userId);
  if (status !== "active") return err("forbidden", "You are not an active member of this circle.");
  return ok(true);
}

export async function createCircle(db: BookDb, actorId: string, name: string): Promise<Result<{ id: string }>> {
  const cleaned = name.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!cleaned) return err("name", "Name the circle.");
  const circleId = id();
  await db.transaction(async (tx) => {
    await tx.query("insert into circles (id, name, created_by) values ($1, $2, $3)", [circleId, cleaned, actorId]);
    await tx.query(
      "insert into circle_members (circle_id, user_id, status) values ($1, $2, 'active')",
      [circleId, actorId],
    );
    await tx.query(
      "insert into audit_events (id, circle_id, actor_id, kind, summary) values ($1, $2, $3, 'circle.created', $4)",
      [id(), circleId, actorId, `Circle “${cleaned}” opened.`],
    );
  });
  return ok({ id: circleId });
}

export async function addCircleMemberByEmail(
  db: BookDb,
  actorId: string,
  circleId: string,
  email: string,
): Promise<Result<true>> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return err("email", "Enter the email they used to sign up.");
  return db.transaction(async (tx) => {
    const allowed = await requireActiveCircle(tx, circleId, actorId);
    if (!allowed.ok) return allowed;
    const user = await one<{ id: string }>(tx, 'select id from "user" where lower(email) = $1', [normalized]);
    if (!user) return err("unknown_user", "No account uses that email yet. They have to sign up first.");
    await tx.query(
      `insert into circle_members (circle_id, user_id, status) values ($1, $2, 'active')
       on conflict (circle_id, user_id) do update set status = 'active'`,
      [circleId, user.id],
    );
    await tx.query(
      "insert into audit_events (id, circle_id, actor_id, kind, summary) values ($1, $2, $3, 'circle.member', $4)",
      [id(), circleId, actorId, "An existing account was added to the circle."],
    );
    return ok(true);
  });
}

export async function createLoan(
  db: BookDb,
  actorId: string,
  input: { circleId: string; lenderId: string; borrowerId: string; principalCents: number; dueOn: string | null; note: string },
): Promise<Result<{ id: string }>> {
  if (input.lenderId === input.borrowerId) return err("same_person", "The lender and the borrower have to be two people.");
  if (!Number.isSafeInteger(input.principalCents) || input.principalCents <= 0) {
    return err("amount", "Enter a loan amount like 25.50.");
  }
  const loanId = id();
  const result = await db.transaction(async (tx) => {
    const allowed = await requireActiveCircle(tx, input.circleId, actorId);
    if (!allowed.ok) return allowed;
    for (const userId of [input.lenderId, input.borrowerId]) {
      const status = await circleRole(tx, input.circleId, userId);
      if (status !== "active") return err("not_member", "Both people have to be active members of this circle.");
    }
    await tx.query(
      `insert into loans (id, circle_id, lender_id, borrower_id, principal_cents, due_on, note)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [loanId, input.circleId, input.lenderId, input.borrowerId, input.principalCents, input.dueOn, input.note.trim().slice(0, 120) || "Loan"],
    );
    return ok({ id: loanId });
  });
  return result;
}

export async function recordRepayment(
  db: BookDb,
  actorId: string,
  input: { loanId: string; amountCents: number; note: string },
): Promise<Result<true>> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    return err("amount", "Enter a repayment like 10.00.");
  }
  return db.transaction(async (tx) => {
    const loan = await one<{
      id: string;
      circle_id: string;
      principal_cents: number;
      voided_at: string | null;
    }>(tx, "select id, circle_id, principal_cents, voided_at from loans where id = $1 for update", [input.loanId]);
    if (!loan) return err("missing_loan", "That loan isn’t in a circle you can use.");
    const allowed = await requireActiveCircle(tx, loan.circle_id, actorId);
    if (!allowed.ok) return allowed;
    if (loan.voided_at) return err("voided", "This loan was voided.");
    const paid = await one<{ sum: number }>(
      tx,
      "select coalesce(sum(amount_cents), 0)::int as sum from repayments where loan_id = $1",
      [loan.id],
    );
    const left = loan.principal_cents - Number(paid?.sum ?? 0);
    if (left <= 0) return err("repaid", "This loan is already written down as repaid.");
    if (input.amountCents > left) return err("exceeds_remaining", "That repayment is larger than what’s still open.");
    await tx.query(
      `insert into repayments (id, loan_id, amount_cents, note, source, recorded_by)
       values ($1, $2, $3, $4, 'manual', $5)`,
      [id(), loan.id, input.amountCents, input.note.trim().slice(0, 120) || "Written down", actorId],
    );
    return ok(true);
  });
}

export async function createJar(
  db: BookDb,
  actorId: string,
  input: { circleId: string; name: string; goalCents: number },
): Promise<Result<{ id: string }>> {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!name) return err("name", "Name the jar.");
  if (!Number.isSafeInteger(input.goalCents) || input.goalCents <= 0) return err("goal", "Set a goal like 40.00.");
  const jarId = id();
  return db.transaction(async (tx) => {
    const allowed = await requireActiveCircle(tx, input.circleId, actorId);
    if (!allowed.ok) return allowed;
    await tx.query(
      "insert into jars (id, circle_id, name, goal_cents, custody) values ($1, $2, $3, $4, 'undecided')",
      [jarId, input.circleId, name, input.goalCents],
    );
    await tx.query("insert into jar_members (jar_id, user_id, status) values ($1, $2, 'active')", [jarId, actorId]);
    await tx.query(
      "insert into audit_events (id, circle_id, jar_id, actor_id, kind, summary) values ($1, $2, $3, $4, 'jar.created', $5)",
      [id(), input.circleId, jarId, actorId, `Jar “${name}” opened. Custody is undecided. Withdrawals need ${APPROVALS_REQUIRED} other active members.`],
    );
    return ok({ id: jarId });
  });
}

export async function addJarMember(
  db: BookDb,
  actorId: string,
  input: { jarId: string; userId: string },
): Promise<Result<true>> {
  return db.transaction(async (tx) => {
    const jar = await one<{ circle_id: string }>(tx, "select circle_id from jars where id = $1", [input.jarId]);
    if (!jar) return err("missing_jar", "That jar isn’t available.");
    const allowed = await requireActiveCircle(tx, jar.circle_id, actorId);
    if (!allowed.ok) return allowed;
    const member = await circleRole(tx, jar.circle_id, input.userId);
    if (member !== "active") return err("not_member", "They have to be an active member of the circle first.");
    await tx.query(
      `insert into jar_members (jar_id, user_id, status) values ($1, $2, 'active')
       on conflict (jar_id, user_id) do update set status = 'active'`,
      [input.jarId, input.userId],
    );
    return ok(true);
  });
}

export async function setJarMemberStatus(
  db: BookDb,
  actorId: string,
  input: { jarId: string; userId: string; status: "active" | "inactive" },
): Promise<Result<true>> {
  return db.transaction(async (tx) => {
    const jar = await one<{ circle_id: string }>(tx, "select circle_id from jars where id = $1", [input.jarId]);
    if (!jar) return err("missing_jar", "That jar isn’t available.");
    const allowed = await requireActiveCircle(tx, jar.circle_id, actorId);
    if (!allowed.ok) return allowed;
    const updated = await tx.query(
      "update jar_members set status = $3 where jar_id = $1 and user_id = $2",
      [input.jarId, input.userId, input.status],
    );
    if (updated.length === 0 && !(await one(tx, "select 1 as ok from jar_members where jar_id = $1 and user_id = $2", [input.jarId, input.userId]))) {
      return err("missing_member", "That person isn’t in this jar.");
    }
    await tx.query(
      "insert into audit_events (id, circle_id, jar_id, actor_id, kind, summary) values ($1, $2, $3, $4, 'jar.member', $5)",
      [
        id(),
        jar.circle_id,
        input.jarId,
        actorId,
        input.status === "inactive"
          ? "A member was marked inactive. Their earlier yes no longer counts. The threshold stays at 3."
          : "A member was marked active. Old votes are not restored.",
      ],
    );
    return ok(true);
  });
}

export async function recordContribution(
  db: BookDb,
  actorId: string,
  input: { jarId: string; amountCents: number; note: string },
): Promise<Result<true>> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) return err("amount", "Enter an amount like 5.00.");
  return db.transaction(async (tx) => {
    const jar = await one<{ circle_id: string }>(tx, "select circle_id from jars where id = $1", [input.jarId]);
    if (!jar) return err("missing_jar", "That jar isn’t available.");
    const allowed = await requireActiveCircle(tx, jar.circle_id, actorId);
    if (!allowed.ok) return allowed;
    const membership = await one<{ status: string }>(
      tx,
      "select status from jar_members where jar_id = $1 and user_id = $2",
      [input.jarId, actorId],
    );
    if (membership?.status !== "active") return err("not_member", "Only an active jar member can record a promise.");
    await tx.query(
      `insert into contributions (id, jar_id, user_id, amount_cents, note, source)
       values ($1, $2, $3, $4, $5, 'recorded')`,
      [id(), input.jarId, actorId, input.amountCents, input.note.trim().slice(0, 120) || "Recorded"],
    );
    return ok(true);
  });
}

async function loadWithdrawal(tx: Queryable, withdrawalId: string): Promise<WithdrawalRow | null> {
  return one<WithdrawalRow>(
    tx,
    `select w.id, w.jar_id, j.circle_id, w.requester_id, w.amount_cents, w.currency,
            w.destination_user_id, w.purpose, w.revision, w.closed
     from withdrawals w
     join jars j on j.id = w.jar_id
     where w.id = $1
     for update`,
    [withdrawalId],
  );
}

function bindingFor(row: WithdrawalRow): string {
  return withdrawalBinding({
    jarId: row.jar_id,
    amountCents: Number(row.amount_cents),
    currency: "USD",
    destinationPersonId: row.destination_user_id,
    purpose: row.purpose,
    revision: Number(row.revision),
  });
}

async function counts(tx: Queryable, row: WithdrawalRow): Promise<{ eligible: number; yes: number; requesterActive: boolean }> {
  const binding = bindingFor(row);
  const eligible = await one<{ n: number }>(
    tx,
    `select count(*)::int as n from jar_members
     where jar_id = $1 and status = 'active' and user_id <> $2`,
    [row.jar_id, row.requester_id],
  );
  const yes = await one<{ n: number }>(
    tx,
    `select count(distinct v.user_id)::int as n
     from withdrawal_votes v
     join jar_members m on m.jar_id = $2 and m.user_id = v.user_id and m.status = 'active'
     where v.withdrawal_id = $1 and v.revision = $3 and v.decision = 'approve'
       and v.binding = $4 and v.user_id <> $5`,
    [row.id, row.jar_id, row.revision, binding, row.requester_id],
  );
  const requester = await one<{ status: string }>(
    tx,
    "select status from jar_members where jar_id = $1 and user_id = $2",
    [row.jar_id, row.requester_id],
  );
  return {
    eligible: Number(eligible?.n ?? 0),
    yes: Number(yes?.n ?? 0),
    requesterActive: requester?.status === "active",
  };
}

export async function createWithdrawal(
  db: BookDb,
  actorId: string,
  input: { jarId: string; amountCents: number; destinationUserId: string; purpose: string },
): Promise<Result<{ id: string }>> {
  const purpose = input.purpose.trim().slice(0, 120);
  if (!purpose) return err("purpose", "Say what the withdrawal is for.");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) return err("amount", "Enter an amount like 20.00.");
  const withdrawalId = id();
  return db.transaction(async (tx) => {
    const jar = await one<{ circle_id: string }>(tx, "select circle_id from jars where id = $1", [input.jarId]);
    if (!jar) return err("missing_jar", "That jar isn’t available.");
    const allowed = await requireActiveCircle(tx, jar.circle_id, actorId);
    if (!allowed.ok) return allowed;
    const membership = await one<{ status: string }>(
      tx,
      "select status from jar_members where jar_id = $1 and user_id = $2",
      [input.jarId, actorId],
    );
    if (membership?.status !== "active") return err("not_member", "The requester has to be an active member of this jar.");
    const destination = await circleRole(tx, jar.circle_id, input.destinationUserId);
    if (destination !== "active") return err("not_member", "The destination has to be an active member of the circle.");
    await tx.query(
      `insert into withdrawals
        (id, jar_id, requester_id, amount_cents, currency, destination_user_id, purpose, revision)
       values ($1, $2, $3, $4, 'USD', $5, $6, 1)`,
      [withdrawalId, input.jarId, actorId, input.amountCents, input.destinationUserId, purpose],
    );
    return ok({ id: withdrawalId });
  });
}

export async function editWithdrawal(
  db: BookDb,
  actorId: string,
  input: { withdrawalId: string; amountCents: number; destinationUserId: string; purpose: string },
): Promise<Result<true>> {
  const purpose = input.purpose.trim().slice(0, 120);
  if (!purpose) return err("purpose", "Say what the withdrawal is for.");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) return err("amount", "Enter an amount like 20.00.");
  return db.transaction(async (tx) => {
    const row = await loadWithdrawal(tx, input.withdrawalId);
    if (!row) return err("missing_withdrawal", "That request isn’t available.");
    const allowed = await requireActiveCircle(tx, row.circle_id, actorId);
    if (!allowed.ok) return allowed;
    if (actorId !== row.requester_id) return err("not_requester", "Only the requester can change this request.");
    if (row.closed) return err("closed", "This request is closed.");
    const same =
      Number(row.amount_cents) === input.amountCents &&
      row.destination_user_id === input.destinationUserId &&
      row.purpose === purpose;
    if (same) return ok(true);
    await tx.query(
      `update withdrawals
       set amount_cents = $2, destination_user_id = $3, purpose = $4, revision = revision + 1, updated_at = now()
       where id = $1`,
      [row.id, input.amountCents, input.destinationUserId, purpose],
    );
    await tx.query(
      "insert into audit_events (id, circle_id, jar_id, actor_id, kind, summary) values ($1, $2, $3, $4, 'withdrawal.edited', $5)",
      [id(), row.circle_id, row.jar_id, actorId, "The amount, destination, or purpose changed. Earlier approvals no longer count."],
    );
    return ok(true);
  });
}

/** The voter is always `actorId` from the session. A body field naming someone else is not accepted. */
export async function approveWithdrawal(db: BookDb, actorId: string, withdrawalId: string): Promise<Result<true>> {
  return db.transaction(async (tx) => {
    const row = await loadWithdrawal(tx, withdrawalId);
    if (!row) return err("missing_withdrawal", "That request isn’t available.");
    const allowed = await requireActiveCircle(tx, row.circle_id, actorId);
    if (!allowed.ok) return allowed;
    if (row.closed) return err("closed", "This request is closed.");
    if (actorId === row.requester_id) return err("self_approval", "The requester can’t approve their own withdrawal.");
    const tally = await counts(tx, row);
    if (tally.eligible < APPROVALS_REQUIRED) {
      return err(
        "need_three_others",
        `Approval needs ${APPROVALS_REQUIRED} other active members. This jar has ${tally.eligible}. The threshold stays ${APPROVALS_REQUIRED}.`,
      );
    }
    const self = await one<{ status: string }>(
      tx,
      "select status from jar_members where jar_id = $1 and user_id = $2",
      [row.jar_id, actorId],
    );
    if (self?.status !== "active") return err("not_eligible", "Only another active member of this jar can approve.");
    const binding = bindingFor(row);
    const inserted = await tx.query<{ decision: string }>(
      `insert into withdrawal_votes (withdrawal_id, user_id, revision, binding, decision)
       values ($1, $2, $3, $4, 'approve')
       on conflict (withdrawal_id, user_id, revision) do nothing
       returning decision`,
      [row.id, actorId, row.revision, binding],
    );
    if (inserted.length === 0) {
      const existing = await one<{ decision: string }>(
        tx,
        "select decision from withdrawal_votes where withdrawal_id = $1 and user_id = $2 and revision = $3",
        [row.id, actorId, row.revision],
      );
      if (existing?.decision === "approve") return ok(true);
      return err("duplicate_decision", "You already recorded a decision for this version.");
    }
    await tx.query(
      "insert into audit_events (id, circle_id, jar_id, actor_id, kind, summary) values ($1, $2, $3, $4, 'withdrawal.approval', $5)",
      [id(), row.circle_id, row.jar_id, actorId, "Recorded a yes from the signed-in member. It does not send money."],
    );
    return ok(true);
  });
}

export async function rejectWithdrawal(db: BookDb, actorId: string, withdrawalId: string): Promise<Result<true>> {
  return db.transaction(async (tx) => {
    const row = await loadWithdrawal(tx, withdrawalId);
    if (!row) return err("missing_withdrawal", "That request isn’t available.");
    const allowed = await requireActiveCircle(tx, row.circle_id, actorId);
    if (!allowed.ok) return allowed;
    if (row.closed === "rejected") return ok(true);
    if (row.closed === "cancelled") return err("closed", "The requester already cancelled this.");
    if (actorId === row.requester_id) return err("self_approval", "The requester can cancel, not reject, their own request.");
    const self = await one<{ status: string }>(
      tx,
      "select status from jar_members where jar_id = $1 and user_id = $2",
      [row.jar_id, actorId],
    );
    if (self?.status !== "active") return err("not_eligible", "Only another active member of this jar can reject.");
    const binding = bindingFor(row);
    await tx.query(
      `insert into withdrawal_votes (withdrawal_id, user_id, revision, binding, decision)
       values ($1, $2, $3, $4, 'reject')
       on conflict (withdrawal_id, user_id, revision) do nothing`,
      [row.id, actorId, row.revision, binding],
    );
    await tx.query("update withdrawals set closed = 'rejected', updated_at = now() where id = $1", [row.id]);
    return ok(true);
  });
}

export async function cancelWithdrawal(db: BookDb, actorId: string, withdrawalId: string): Promise<Result<true>> {
  return db.transaction(async (tx) => {
    const row = await loadWithdrawal(tx, withdrawalId);
    if (!row) return err("missing_withdrawal", "That request isn’t available.");
    const allowed = await requireActiveCircle(tx, row.circle_id, actorId);
    if (!allowed.ok) return allowed;
    if (row.closed === "cancelled") return ok(true);
    if (actorId !== row.requester_id) return err("not_requester", "Only the requester can cancel.");
    if (row.closed === "rejected") return err("closed", "This request was already rejected.");
    await tx.query("update withdrawals set closed = 'cancelled', updated_at = now() where id = $1", [row.id]);
    return ok(true);
  });
}

export async function checkWithdrawal(
  db: BookDb,
  actorId: string,
  input: { withdrawalId: string; idempotencyKey: string },
): Promise<Result<{ fundsMoved: false; reasons: string[] }>> {
  const key = input.idempotencyKey.trim();
  if (!key) return err("idempotency", "Missing idempotency key.");
  return db.transaction(async (tx) => {
    const row = await loadWithdrawal(tx, input.withdrawalId);
    if (!row) return err("missing_withdrawal", "That request isn’t available.");
    const allowed = await requireActiveCircle(tx, row.circle_id, actorId);
    if (!allowed.ok) return allowed;
    const existing = await one<{ reasons: string }>(
      tx,
      "select reasons from withdrawal_checks where withdrawal_id = $1 and idempotency_key = $2",
      [row.id, key],
    );
    if (existing) return ok({ fundsMoved: false as const, reasons: existing.reasons.split("|") });
    const tally = await counts(tx, row);
    const standing = policyStanding({
      closed: row.closed,
      eligibleCount: tally.eligible,
      validYesCount: tally.yes,
      requesterActive: tally.requesterActive,
    });
    const reasons: string[] = [];
    if (standing !== "policy_approved") reasons.push(standing === "blocked" ? "need_3_other_active_members" : `not_policy_approved:${standing}`);
    reasons.push("insufficient_confirmed_funds", "jar_custody_not_approved", "transfers_disabled");
    await tx.query(
      `insert into withdrawal_checks (withdrawal_id, idempotency_key, funds_moved, policy_approved, reasons)
       values ($1, $2, false, $3, $4)`,
      [row.id, key, standing === "policy_approved", reasons.join("|")],
    );
    return ok({ fundsMoved: false as const, reasons });
  });
}

export type CircleSnapshot = {
  circle: { id: string; name: string };
  members: MemberRow[];
  loans: {
    id: string;
    lenderId: string;
    borrowerId: string;
    principalCents: number;
    remainingCents: number;
    note: string;
    voided: boolean;
  }[];
  jars: {
    id: string;
    name: string;
    goalCents: number;
    recordedCents: number;
    confirmedCents: number;
    members: { userId: string; name: string; status: string }[];
    contributions: { id: string; userId: string; name: string; amountCents: number; note: string; source: "recorded" }[];
    withdrawals: {
      id: string;
      requesterId: string;
      requesterName: string;
      amountCents: number;
      destinationUserId: string;
      destinationName: string;
      purpose: string;
      revision: number;
      standing: string;
      yesCount: number;
      eligibleCount: number;
      lastCheck: { fundsMoved: false; reasons: string[] } | null;
    }[];
  }[];
};

export async function listMyCircles(db: BookDb, actorId: string): Promise<{ id: string; name: string }[]> {
  return db.query<{ id: string; name: string }>(
    `select c.id, c.name from circles c
     join circle_members m on m.circle_id = c.id
     where m.user_id = $1 and m.status = 'active'
     order by c.created_at`,
    [actorId],
  );
}

export async function circleSnapshot(db: BookDb, actorId: string, circleId: string): Promise<Result<CircleSnapshot>> {
  const allowed = await requireActiveCircle(db, circleId, actorId);
  if (!allowed.ok) return allowed;
  const circle = await one<{ id: string; name: string }>(db, "select id, name from circles where id = $1", [circleId]);
  if (!circle) return err("missing_circle", "That circle isn’t available.");
  const members = await db.query<MemberRow>(
    `select m.user_id, m.status, u.name, u.email
     from circle_members m join "user" u on u.id = m.user_id
     where m.circle_id = $1 order by u.name`,
    [circleId],
  );
  const loanRows = await db.query<{
    id: string;
    lender_id: string;
    borrower_id: string;
    principal_cents: number;
    note: string;
    voided_at: string | null;
    paid: number;
  }>(
    `select l.id, l.lender_id, l.borrower_id, l.principal_cents, l.note, l.voided_at,
            coalesce((select sum(amount_cents) from repayments r where r.loan_id = l.id), 0)::int as paid
     from loans l where l.circle_id = $1 order by l.opened_at`,
    [circleId],
  );
  const jarRows = await db.query<{ id: string; name: string; goal_cents: number }>(
    "select id, name, goal_cents from jars where circle_id = $1 order by created_at",
    [circleId],
  );
  const jars = [];
  for (const jar of jarRows) {
    const jarMembers = await db.query<{ user_id: string; name: string; status: string }>(
      `select m.user_id, u.name, m.status from jar_members m
       join "user" u on u.id = m.user_id where m.jar_id = $1 order by u.name`,
      [jar.id],
    );
    const contributions = await db.query<{ id: string; user_id: string; name: string; amount_cents: number; note: string; source: "recorded" }>(
      `select c.id, c.user_id, u.name, c.amount_cents, c.note, c.source
       from contributions c join "user" u on u.id = c.user_id
       where c.jar_id = $1 order by c.recorded_at`,
      [jar.id],
    );
    const recorded = contributions.reduce((sum, row) => sum + Number(row.amount_cents), 0);
    const withdrawalRows = await db.query<WithdrawalRow & { requester_name: string; destination_name: string }>(
      `select w.id, w.jar_id, j.circle_id, w.requester_id, w.amount_cents, w.currency,
              w.destination_user_id, w.purpose, w.revision, w.closed,
              ru.name as requester_name, du.name as destination_name
       from withdrawals w
       join jars j on j.id = w.jar_id
       join "user" ru on ru.id = w.requester_id
       join "user" du on du.id = w.destination_user_id
       where w.jar_id = $1 order by w.created_at`,
      [jar.id],
    );
    const withdrawals = [];
    for (const row of withdrawalRows) {
      const tally = await counts(db, row);
      const standing = policyStanding({
        closed: row.closed,
        eligibleCount: tally.eligible,
        validYesCount: tally.yes,
        requesterActive: tally.requesterActive,
      });
      const check = await one<{ reasons: string }>(
        db,
        "select reasons from withdrawal_checks where withdrawal_id = $1 order by checked_at desc limit 1",
        [row.id],
      );
      withdrawals.push({
        id: row.id,
        requesterId: row.requester_id,
        requesterName: row.requester_name,
        amountCents: Number(row.amount_cents),
        destinationUserId: row.destination_user_id,
        destinationName: row.destination_name,
        purpose: row.purpose,
        revision: Number(row.revision),
        standing,
        yesCount: tally.yes,
        eligibleCount: tally.eligible,
        lastCheck: check ? { fundsMoved: false as const, reasons: check.reasons.split("|") } : null,
      });
    }
    jars.push({
      id: jar.id,
      name: jar.name,
      goalCents: Number(jar.goal_cents),
      recordedCents: recorded,
      confirmedCents: 0,
      members: jarMembers.map((member) => ({ userId: member.user_id, name: member.name, status: member.status })),
      contributions: contributions.map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        amountCents: Number(row.amount_cents),
        note: row.note,
        source: "recorded" as const,
      })),
      withdrawals,
    });
  }
  return ok({
    circle,
    members,
    loans: loanRows.map((loan) => ({
      id: loan.id,
      lenderId: loan.lender_id,
      borrowerId: loan.borrower_id,
      principalCents: Number(loan.principal_cents),
      remainingCents: loan.voided_at ? 0 : Math.max(0, Number(loan.principal_cents) - Number(loan.paid)),
      note: loan.note,
      voided: Boolean(loan.voided_at),
    })),
    jars,
  });
}

/** Ignore any voter id in a client payload. */
export function approvalActor(sessionUserId: string, _body: unknown): string {
  return sessionUserId;
}
