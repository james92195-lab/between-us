import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { auth } from "@/lib/auth/server";
import { getBookDb } from "./db.ts";
import {
  addCircleMemberByEmail,
  addJarMember,
  approvalActor,
  approveWithdrawal,
  cancelWithdrawal,
  checkWithdrawal,
  circleSnapshot,
  createCircle,
  createJar,
  createLoan,
  createWithdrawal,
  editWithdrawal,
  listMyCircles,
  recordContribution,
  recordRepayment,
  rejectWithdrawal,
  setJarMemberStatus,
} from "./service.ts";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (request.method === "GET") return {};
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cents(value: unknown): number {
  return typeof value === "number" ? value : Number.NaN;
}

export async function handleBooks(request: Request): Promise<Response> {
  assertSameSiteRequest();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return json({ ok: false, error: "Sign in required." }, 401);
  const actorId = approvalActor(session.user.id, await readBody(request.clone()));
  const db = await getBookDb();
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const rest = parts.slice(parts.indexOf("books") + 1);
  const body = request.method === "GET" ? {} : await readBody(request);

  try {
    if (request.method === "GET" && rest.length === 1 && rest[0] === "circles") {
      return json({ ok: true, circles: await listMyCircles(db, actorId) });
    }
    if (request.method === "POST" && rest.length === 1 && rest[0] === "circles") {
      const created = await createCircle(db, actorId, text(body.name));
      return json(created.ok ? { ok: true, id: created.value.id } : { ok: false, error: created.error }, created.ok ? 200 : 400);
    }
    if (request.method === "GET" && rest[0] === "circles" && rest.length === 2) {
      const snap = await circleSnapshot(db, actorId, rest[1]);
      return json(snap.ok ? { ok: true, snapshot: snap.value } : { ok: false, error: snap.error }, snap.ok ? 200 : 403);
    }
    if (request.method === "POST" && rest[0] === "circles" && rest[2] === "members" && rest.length === 3) {
      const added = await addCircleMemberByEmail(db, actorId, rest[1], text(body.email));
      return json(added.ok ? { ok: true } : { ok: false, error: added.error }, added.ok ? 200 : 400);
    }
    if (request.method === "POST" && rest[0] === "loans" && rest.length === 1) {
      const created = await createLoan(db, actorId, {
        circleId: text(body.circleId),
        lenderId: text(body.lenderId),
        borrowerId: text(body.borrowerId),
        principalCents: cents(body.principalCents),
        dueOn: text(body.dueOn) || null,
        note: text(body.note),
      });
      return json(created.ok ? { ok: true, id: created.value.id } : { ok: false, error: created.error }, created.ok ? 200 : 400);
    }
    if (request.method === "POST" && rest[0] === "loans" && rest[2] === "repayments") {
      const saved = await recordRepayment(db, actorId, {
        loanId: rest[1],
        amountCents: cents(body.amountCents),
        note: text(body.note),
      });
      return json(saved.ok ? { ok: true } : { ok: false, error: saved.error }, saved.ok ? 200 : 400);
    }
    if (request.method === "POST" && rest[0] === "jars" && rest.length === 1) {
      const created = await createJar(db, actorId, {
        circleId: text(body.circleId),
        name: text(body.name),
        goalCents: cents(body.goalCents),
      });
      return json(created.ok ? { ok: true, id: created.value.id } : { ok: false, error: created.error }, created.ok ? 200 : 400);
    }
    if (request.method === "POST" && rest[0] === "jars" && rest[2] === "members" && rest.length === 3) {
      const added = await addJarMember(db, actorId, { jarId: rest[1], userId: text(body.userId) });
      return json(added.ok ? { ok: true } : { ok: false, error: added.error }, added.ok ? 200 : 400);
    }
    if (request.method === "POST" && rest[0] === "jars" && rest[2] === "members" && rest[3] === "status") {
      const status = body.status === "inactive" ? "inactive" : "active";
      const saved = await setJarMemberStatus(db, actorId, { jarId: rest[1], userId: text(body.userId), status });
      return json(saved.ok ? { ok: true } : { ok: false, error: saved.error }, saved.ok ? 200 : 400);
    }
    if (request.method === "POST" && rest[0] === "jars" && rest[2] === "contributions") {
      const saved = await recordContribution(db, actorId, {
        jarId: rest[1],
        amountCents: cents(body.amountCents),
        note: text(body.note),
      });
      return json(saved.ok ? { ok: true } : { ok: false, error: saved.error }, saved.ok ? 200 : 400);
    }
    if (request.method === "POST" && rest[0] === "withdrawals" && rest.length === 1) {
      const created = await createWithdrawal(db, actorId, {
        jarId: text(body.jarId),
        amountCents: cents(body.amountCents),
        destinationUserId: text(body.destinationUserId),
        purpose: text(body.purpose),
      });
      return json(created.ok ? { ok: true, id: created.value.id } : { ok: false, error: created.error }, created.ok ? 200 : 400);
    }
    if (request.method === "POST" && rest[0] === "withdrawals" && rest[2] === "edit") {
      const saved = await editWithdrawal(db, actorId, {
        withdrawalId: rest[1],
        amountCents: cents(body.amountCents),
        destinationUserId: text(body.destinationUserId),
        purpose: text(body.purpose),
      });
      return json(saved.ok ? { ok: true } : { ok: false, error: saved.error }, saved.ok ? 200 : 400);
    }
    if (request.method === "POST" && rest[0] === "withdrawals" && rest[2] === "approve") {
      const saved = await approveWithdrawal(db, actorId, rest[1]);
      return json(saved.ok ? { ok: true } : { ok: false, error: saved.error }, saved.ok ? 200 : 400);
    }
    if (request.method === "POST" && rest[0] === "withdrawals" && rest[2] === "reject") {
      const saved = await rejectWithdrawal(db, actorId, rest[1]);
      return json(saved.ok ? { ok: true } : { ok: false, error: saved.error }, saved.ok ? 200 : 400);
    }
    if (request.method === "POST" && rest[0] === "withdrawals" && rest[2] === "cancel") {
      const saved = await cancelWithdrawal(db, actorId, rest[1]);
      return json(saved.ok ? { ok: true } : { ok: false, error: saved.error }, saved.ok ? 200 : 400);
    }
    if (request.method === "POST" && rest[0] === "withdrawals" && rest[2] === "check") {
      const saved = await checkWithdrawal(db, actorId, {
        withdrawalId: rest[1],
        idempotencyKey: text(body.idempotencyKey) || `check:${rest[1]}`,
      });
      return json(saved.ok ? { ok: true, ...saved.value } : { ok: false, error: saved.error }, saved.ok ? 200 : 400);
    }
    return json({ ok: false, error: "Unknown books request." }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The book could not be saved.";
    return json({ ok: false, error: message }, 500);
  }
}
