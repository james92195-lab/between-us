import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Alert, Field, PrimaryButton, QuietButton, fieldClass } from "@/components/ui";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { CircleSnapshot } from "@/lib/books/service";
import { formatMoney, parseMoneyToCents } from "@/lib/money";

export const Route = createFileRoute("/circles/$circleId")({ component: CirclePage });

async function post(path: string, body?: unknown): Promise<string | null> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  return payload.ok ? null : payload.error ?? "That didn’t save.";
}

function CirclePage() {
  const { circleId } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [snapshot, setSnapshot] = useState<CircleSnapshot | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [jarName, setJarName] = useState("");
  const [jarGoal, setJarGoal] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [lenderId, setLenderId] = useState("");
  const [borrowerId, setBorrowerId] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/books/circles/${circleId}`, { credentials: "include" });
    const body = (await response.json()) as { ok: boolean; snapshot?: CircleSnapshot; error?: string };
    if (!body.ok || !body.snapshot) setError(body.error ?? "Could not open this circle.");
    else {
      setError("");
      setSnapshot(body.snapshot);
    }
  }, [circleId]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (isPending) {
    return (
      <Shell mode="account">
        <p className="text-muted">Checking your session…</p>
      </Shell>
    );
  }
  if (!user) return <Navigate to="/login" />;

  const nameOf = (id: string) => snapshot?.members.find((member) => member.user_id === id)?.name ?? "Someone";

  return (
    <Shell mode="account">
      <Link to="/" className="text-sm text-ember">
        Circles
      </Link>
      <h1 className="mt-2 font-display text-4xl">{snapshot?.circle.name ?? "Circle"}</h1>
      <p className="mt-2 text-sm text-muted">
        Signed in as {user.primaryEmail}. The approve button uses this session only. You cannot vote as someone else.
      </p>
      {error ? (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="font-display text-2xl">Members</h2>
        <ul className="mt-2">
          {snapshot?.members.map((member) => (
            <li key={member.user_id} className="border-b border-line py-2 text-sm">
              {member.name} · {member.email} · {member.status}
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void post(`/api/books/circles/${circleId}/members`, { email }).then((reason) => {
              setError(reason ?? "");
              if (!reason) {
                setEmail("");
                void load();
              }
            });
          }}
        >
          <Field label="Add an existing account by email">
            <input type="email" className={fieldClass} value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <PrimaryButton type="submit" className="sm:mt-6">
            Add
          </PrimaryButton>
        </form>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-2xl">Loan</h2>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const cents = parseMoneyToCents(loanAmount);
            if (!cents) {
              setError("Enter a loan amount like 25.50.");
              return;
            }
            void post("/api/books/loans", {
              circleId,
              lenderId: lenderId || snapshot?.members[0]?.user_id,
              borrowerId: borrowerId || snapshot?.members[1]?.user_id,
              principalCents: cents,
              note: "Loan",
            }).then((reason) => {
              setError(reason ?? "");
              if (!reason) void load();
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Lender">
              <select className={fieldClass} value={lenderId} onChange={(event) => setLenderId(event.target.value)}>
                {snapshot?.members.filter((member) => member.status === "active").map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Borrower">
              <select className={fieldClass} value={borrowerId} onChange={(event) => setBorrowerId(event.target.value)}>
                {snapshot?.members.filter((member) => member.status === "active").map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Amount">
            <input className={fieldClass} value={loanAmount} onChange={(event) => setLoanAmount(event.target.value)} placeholder="25.50" />
          </Field>
          <PrimaryButton type="submit">Record loan</PrimaryButton>
        </form>
        <ul className="mt-3">
          {snapshot?.loans.map((loan) => (
            <li key={loan.id} className="flex items-center justify-between gap-3 border-b border-line py-3 text-sm">
              <span>
                {nameOf(loan.lenderId)} lent {nameOf(loan.borrowerId)} · {loan.note}
                <span className="mt-1 block text-muted">Still open {formatMoney(loan.remainingCents)}. Written down, not a bank payment.</span>
              </span>
              <QuietButton
                type="button"
                onClick={() => {
                  const cents = parseMoneyToCents("10.00");
                  if (!cents) return;
                  void post(`/api/books/loans/${loan.id}/repayments`, { amountCents: cents, note: "Written down" }).then((reason) => {
                    setError(reason ?? "");
                    if (!reason) void load();
                  });
                }}
              >
                Write down $10
              </QuietButton>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-2xl">Shared jar</h2>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const cents = parseMoneyToCents(jarGoal);
            if (!cents) {
              setError("Set a goal like 40.00.");
              return;
            }
            void post("/api/books/jars", { circleId, name: jarName, goalCents: cents }).then((reason) => {
              setError(reason ?? "");
              if (!reason) {
                setJarName("");
                setJarGoal("");
                void load();
              }
            });
          }}
        >
          <Field label="Jar name">
            <input className={fieldClass} value={jarName} onChange={(event) => setJarName(event.target.value)} />
          </Field>
          <Field label="Goal">
            <input className={fieldClass} value={jarGoal} onChange={(event) => setJarGoal(event.target.value)} placeholder="40.00" />
          </Field>
          <PrimaryButton type="submit">Create jar</PrimaryButton>
        </form>
        {snapshot?.jars.map((jar) => (
          <JarBlock
            key={jar.id}
            jar={jar}
            circleMembers={snapshot.members}
            userId={user.id}
            onError={setError}
            reload={load}
          />
        ))}
      </section>
    </Shell>
  );
}

function JarBlock({
  jar,
  circleMembers,
  userId,
  onError,
  reload,
}: {
  jar: CircleSnapshot["jars"][number];
  circleMembers: CircleSnapshot["members"];
  userId: string;
  onError: (message: string) => void;
  reload: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [destination, setDestination] = useState(jar.members[0]?.userId ?? "");
  const [memberId, setMemberId] = useState("");

  return (
    <article className="mt-4 rounded-3xl border border-line bg-card p-4">
      <h3 className="font-display text-2xl">{jar.name}</h3>
      <p className="text-sm text-muted">
        Recorded promises {formatMoney(jar.recordedCents)} of {formatMoney(jar.goalCents)}. Provider-confirmed {formatMoney(jar.confirmedCents)}. Not a wallet. Custody is undecided.
      </p>
      <p className="mt-2 text-sm">
        Withdrawals need 3 other active members. Your approve button is your own account.
      </p>
      <ul className="mt-2 text-sm">
        {jar.members.map((member) => (
          <li key={member.userId} className="flex items-center justify-between gap-2 py-1">
            <span>
              {member.name} · {member.status}
            </span>
            <button
              type="button"
              className="text-muted"
              onClick={() => {
                void post(`/api/books/jars/${jar.id}/members/status`, {
                  userId: member.userId,
                  status: member.status === "active" ? "inactive" : "active",
                }).then((reason) => {
                  onError(reason ?? "");
                  if (!reason) void reload();
                });
              }}
            >
              {member.status === "active" ? "Mark inactive" : "Mark active"}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void post(`/api/books/jars/${jar.id}/members`, { userId: memberId }).then((reason) => {
            onError(reason ?? "");
            if (!reason) void reload();
          });
        }}
      >
        <Field label="Add a circle member to this jar">
          <select className={fieldClass} value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            <option value="">Choose</option>
            {circleMembers
              .filter((member) => member.status === "active" && !jar.members.some((row) => row.userId === member.user_id))
              .map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.name}
                </option>
              ))}
          </select>
        </Field>
        <QuietButton type="submit" className="sm:mt-6">
          Add to jar
        </QuietButton>
      </form>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const cents = parseMoneyToCents(amount);
          if (!cents) {
            onError("Enter an amount like 5.00.");
            return;
          }
          void post(`/api/books/jars/${jar.id}/contributions`, { amountCents: cents, note: "Promise" }).then((reason) => {
            onError(reason ?? "");
            if (!reason) {
              setAmount("");
              void reload();
            }
          });
        }}
      >
        <Field label="Record a promise">
          <input className={fieldClass} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="5.00" />
        </Field>
        <PrimaryButton type="submit">Record promise</PrimaryButton>
      </form>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const cents = parseMoneyToCents(withdrawAmount);
          if (!cents) {
            onError("Enter a withdrawal amount like 10.00.");
            return;
          }
          void post("/api/books/withdrawals", {
            jarId: jar.id,
            amountCents: cents,
            destinationUserId: destination,
            purpose,
          }).then((reason) => {
            onError(reason ?? "");
            if (!reason) {
              setWithdrawAmount("");
              void reload();
            }
          });
        }}
      >
        <Field label="Withdrawal amount">
          <input className={fieldClass} value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} placeholder="10.00" />
        </Field>
        <Field label="Destination">
          <select className={fieldClass} value={destination} onChange={(event) => setDestination(event.target.value)}>
            {jar.members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Purpose">
          <input className={fieldClass} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Groceries" />
        </Field>
        <QuietButton type="submit">Request withdrawal</QuietButton>
      </form>
      <ul className="mt-3 flex flex-col gap-3">
        {jar.withdrawals.map((request) => (
          <li key={request.id} className="rounded-2xl border border-line p-3">
            <p className="text-xs tracking-widest text-ember uppercase">{request.standing.replaceAll("_", " ")}</p>
            <p className="font-display text-3xl tabular-nums">{formatMoney(request.amountCents)}</p>
            <p className="text-sm text-muted">
              {request.requesterName} asks to pay {request.destinationName}. {request.purpose}. Version {request.revision}. {request.yesCount} of 3 yeses. {request.eligibleCount} other active members.
            </p>
            {request.lastCheck ? (
              <p className="mt-1 text-sm text-muted">Last check did not move money. {request.lastCheck.reasons.join(", ")}.</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {request.requesterId === userId ? null : (
                <PrimaryButton
                  type="button"
                  onClick={() => {
                    void post(`/api/books/withdrawals/${request.id}/approve`, { userId: "someone-else" }).then((reason) => {
                      onError(reason ?? "");
                      void reload();
                    });
                  }}
                >
                  Approve as me
                </PrimaryButton>
              )}
              <QuietButton
                type="button"
                onClick={() => {
                  void post(`/api/books/withdrawals/${request.id}/check`, { idempotencyKey: `check:${request.id}:${request.revision}` }).then((reason) => {
                    onError(reason ?? "No transfer was created.");
                    void reload();
                  });
                }}
              >
                Check send status
              </QuietButton>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

