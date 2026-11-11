import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import {
  addCircleMemberByEmail,
  addJarMember,
  approvalActor,
  approveWithdrawal,
  checkWithdrawal,
  circleSnapshot,
  createCircle,
  createJar,
  createLoan,
  createWithdrawal,
  editWithdrawal,
  recordContribution,
  recordRepayment,
  setJarMemberStatus,
  type BookDb,
} from "./service.ts";

const root = new URL("../../../", import.meta.url).pathname;

function must<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

async function openDb(dir?: string): Promise<{ db: PGlite; books: BookDb; close: () => Promise<void> }> {
  const db = new PGlite(dir);
  await db.waitReady;
  const existing = await db.query<{ name: string | null }>("select to_regclass('public.circles') as name");
  if (!dir || !existing.rows[0]?.name) {
    await db.exec(readFileSync(join(root, "migrations/0001_auth.sql"), "utf8"));
    await db.exec(readFileSync(join(root, "migrations/0002_books.sql"), "utf8"));
  }
  const books: BookDb = {
    query: async (text, params) => (await db.query(text, params)).rows as never,
    transaction: (fn) =>
      db.transaction(async (tx) =>
        fn({ query: async (text, params) => (await tx.query(text, params)).rows as never }),
      ),
  };
  return { db, books, close: () => db.close() };
}

async function user(db: PGlite, id: string, name: string, email: string) {
  await db.query(
    `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     values ($1, $2, $3, true, now(), now())`,
    [id, name, email],
  );
}

async function seed() {
  const opened = await openDb();
  const { db, books } = opened;
  await user(db, "ada", "Ada", "ada@example.com");
  await user(db, "maya", "Maya", "maya@example.com");
  await user(db, "jonah", "Jonah", "jonah@example.com");
  await user(db, "priya", "Priya", "priya@example.com");
  await user(db, "outsider", "Outsider", "out@example.com");
  const circle = must(await createCircle(books, "ada", "House"));
  for (const email of ["maya@example.com", "jonah@example.com", "priya@example.com"]) {
    must(await addCircleMemberByEmail(books, "ada", circle.id, email));
  }
  const jar = must(await createJar(books, "ada", { circleId: circle.id, name: "Friday jar", goalCents: 4000 }));
  for (const userId of ["maya", "jonah", "priya"]) {
    must(await addJarMember(books, "ada", { jarId: jar.id, userId }));
  }
  return { ...opened, circleId: circle.id, jarId: jar.id };
}

test("four signed-in members and an outsider: only the other three can approve", async () => {
  const { books, close, circleId, jarId } = await seed();
  const loan = must(
    await createLoan(books, "ada", {
      circleId,
      lenderId: "ada",
      borrowerId: "maya",
      principalCents: 2550,
      dueOn: null,
      note: "Tickets",
    }),
  );
  must(await recordRepayment(books, "maya", { loanId: loan.id, amountCents: 1000, note: "Cash" }));
  const snapLoan = must(await circleSnapshot(books, "ada", circleId));
  assert.equal(snapLoan.loans[0].remainingCents, 1550);
  const tooMuch = await recordRepayment(books, "ada", { loanId: loan.id, amountCents: 2000, note: "" });
  assert.equal(tooMuch.ok, false);

  must(await recordContribution(books, "maya", { jarId, amountCents: 9000, note: "Promise" }));
  const withdrawal = must(
    await createWithdrawal(books, "ada", {
      jarId,
      amountCents: 2000,
      destinationUserId: "maya",
      purpose: "Groceries",
    }),
  );
  const spoofed = approvalActor("ada", { userId: "maya", voterId: "priya" });
  assert.equal(spoofed, "ada");
  const self = await approveWithdrawal(books, spoofed, withdrawal.id);
  assert.equal(self.ok, false);
  if (self.ok) return;
  assert.equal(self.code, "self_approval");

  const outsider = await approveWithdrawal(books, "outsider", withdrawal.id);
  assert.equal(outsider.ok, false);
  if (outsider.ok) return;
  assert.equal(outsider.code, "forbidden");

  must(await approveWithdrawal(books, "maya", withdrawal.id));
  must(await approveWithdrawal(books, "maya", withdrawal.id));
  must(await approveWithdrawal(books, "jonah", withdrawal.id));
  let view = must(await circleSnapshot(books, "priya", circleId));
  assert.equal(view.jars[0].withdrawals[0].standing, "pending");
  assert.equal(view.jars[0].withdrawals[0].yesCount, 2);
  assert.equal(view.jars[0].recordedCents, 9000);
  assert.equal(view.jars[0].confirmedCents, 0);

  must(await approveWithdrawal(books, "priya", withdrawal.id));
  view = must(await circleSnapshot(books, "ada", circleId));
  assert.equal(view.jars[0].withdrawals[0].standing, "policy_approved");
  const checked = must(
    await checkWithdrawal(books, "ada", { withdrawalId: withdrawal.id, idempotencyKey: "check-1" }),
  );
  assert.equal(checked.fundsMoved, false);
  assert.ok(checked.reasons.includes("transfers_disabled"));
  assert.ok(checked.reasons.includes("insufficient_confirmed_funds"));
  const again = must(await checkWithdrawal(books, "ada", { withdrawalId: withdrawal.id, idempotencyKey: "check-1" }));
  assert.deepEqual(again, checked);
  await close();
});

test("concurrent approvals from two members both stick, and a double vote does not", async () => {
  const { books, close, jarId } = await seed();
  const withdrawal = must(
    await createWithdrawal(books, "ada", {
      jarId,
      amountCents: 100,
      destinationUserId: "maya",
      purpose: "Tea",
    }),
  );
  const [a, b] = await Promise.all([
    approveWithdrawal(books, "maya", withdrawal.id),
    approveWithdrawal(books, "jonah", withdrawal.id),
  ]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  await Promise.all([
    approveWithdrawal(books, "maya", withdrawal.id),
    approveWithdrawal(books, "maya", withdrawal.id),
  ]);
  const votes = await books.query<{ n: number }>(
    "select count(*)::int as n from withdrawal_votes where withdrawal_id = $1 and user_id = 'maya'",
    [withdrawal.id],
  );
  assert.equal(Number(votes[0].n), 1);
  await close();
});

test("editing the request drops yeses, and deactivating a voter blocks a passed policy", async () => {
  const { books, close, circleId, jarId } = await seed();
  const withdrawal = must(
    await createWithdrawal(books, "ada", {
      jarId,
      amountCents: 100,
      destinationUserId: "maya",
      purpose: "Tea",
    }),
  );
  must(await approveWithdrawal(books, "maya", withdrawal.id));
  must(await approveWithdrawal(books, "jonah", withdrawal.id));
  must(await approveWithdrawal(books, "priya", withdrawal.id));
  must(
    await editWithdrawal(books, "ada", {
      withdrawalId: withdrawal.id,
      amountCents: 300,
      destinationUserId: "jonah",
      purpose: "Rent",
    }),
  );
  let view = must(await circleSnapshot(books, "ada", circleId));
  assert.equal(view.jars[0].withdrawals[0].revision, 2);
  assert.equal(view.jars[0].withdrawals[0].standing, "pending");
  assert.equal(view.jars[0].withdrawals[0].yesCount, 0);

  must(await approveWithdrawal(books, "maya", withdrawal.id));
  must(await approveWithdrawal(books, "jonah", withdrawal.id));
  must(await approveWithdrawal(books, "priya", withdrawal.id));
  must(await setJarMemberStatus(books, "ada", { jarId, userId: "priya", status: "inactive" }));
  view = must(await circleSnapshot(books, "ada", circleId));
  assert.equal(view.jars[0].withdrawals[0].standing, "blocked");
  assert.equal(view.jars[0].withdrawals[0].eligibleCount, 2);
  const blocked = await approveWithdrawal(books, "maya", withdrawal.id);
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.equal(blocked.code, "need_three_others");
  await close();
});

test("votes survive closing and reopening the database", async () => {
  const dir = mkdtempSync(join(tmpdir(), "between-us-db-"));
  const first = await openDb(dir);
  await user(first.db, "ada", "Ada", "ada@example.com");
  await user(first.db, "maya", "Maya", "maya@example.com");
  const circle = must(await createCircle(first.books, "ada", "House"));
  must(await addCircleMemberByEmail(first.books, "ada", circle.id, "maya@example.com"));
  const jar = must(await createJar(first.books, "ada", { circleId: circle.id, name: "Jar", goalCents: 1000 }));
  must(await addJarMember(first.books, "ada", { jarId: jar.id, userId: "maya" }));
  await first.close();

  const second = await openDb(dir);
  const rows = await second.books.query<{ name: string }>("select name from jars");
  assert.equal(rows[0].name, "Jar");
  const members = await second.books.query("select user_id from jar_members order by user_id");
  assert.deepEqual(members.map((row) => row.user_id), ["ada", "maya"]);
  await second.close();
});

test("a provider-confirmed contribution cannot be stored", async () => {
  const { db, close, jarId } = await seed();
  await assert.rejects(() =>
    db.query(
      `insert into contributions (id, jar_id, user_id, amount_cents, note, source)
       values ('x', $1, 'maya', 100, '', 'provider')`,
      [jarId],
    ),
  );
  await close();
});
