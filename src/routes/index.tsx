import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { JarArt, PersonMark } from "@/components/marks";
import {
  balances,
  entryTitle,
  formatDay,
  formatMoney,
  jarCents,
  nameOf,
  settlePlan,
} from "@/lib/ledger";
import { useLedger } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const people = useLedger((s) => s.people);
  const entries = useLedger((s) => s.entries);
  const causeName = useLedger((s) => s.causeName);
  const goalCents = useLedger((s) => s.goalCents);
  const you = people.find((person) => person.isYou) ?? people[0];
  const bal = balances(people, entries);
  const yours = you ? (bal[you.id] ?? 0) : 0;
  const jar = jarCents(entries);
  const ratio = goalCents > 0 ? jar / goalCents : 0;
  const plan = settlePlan(bal).slice(0, 3);
  const recent = [...entries].sort((a, b) => b.at - a.at).slice(0, 4);

  return (
    <Shell>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-widest text-ember uppercase">The circle</p>
        {yours === 0 ? (
          <>
            <h1 className="mt-2 font-display text-4xl">You’re square</h1>
            <p className="mt-2 text-muted">Nobody is carrying you, and you aren’t carrying them.</p>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-display text-4xl md:text-5xl">{yours > 0 ? "You’re owed" : "You owe"}</h1>
            <p className="mt-1 font-display text-5xl tabular-nums">{formatMoney(Math.abs(yours))}</p>
          </>
        )}
        <p className="mt-3 max-w-md text-sm text-muted">Interest-free. Log who paid, split it, and let the spare change collect.</p>
      </header>

      <section className="mb-4 rounded-3xl border border-line bg-card p-3">
        <ul>
          {people.map((person) => {
            const cents = bal[person.id] ?? 0;
            const standing = person.isYou
              ? cents > 0
                ? "you're owed"
                : cents < 0
                  ? "you owe"
                  : "you're square"
              : cents > 0
                ? "is owed"
                : cents < 0
                  ? "owes"
                  : "square";
            return (
              <li key={person.id} className="flex items-center gap-3 px-2 py-2">
                <PersonMark name={person.name} you={person.isYou} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{person.name}</p>
                  <p className="text-sm text-muted">{standing}</p>
                </div>
                <p className="font-medium tabular-nums">{cents === 0 ? "—" : formatMoney(Math.abs(cents))}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <Link
        to="/jar"
        className="mb-4 flex items-center gap-4 rounded-3xl border border-line bg-ink p-4 text-paper"
      >
        <JarArt ratio={ratio} compact />
        <div className="min-w-0">
          <p className="text-xs tracking-widest text-paper/70 uppercase">The jar</p>
          <p className="mt-1 font-display text-3xl tabular-nums">{formatMoney(jar)}</p>
          <p className="mt-1 text-sm text-paper/75">
            {causeName} · {formatMoney(goalCents)} goal
          </p>
        </div>
      </Link>

      {plan.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-display text-2xl">Settle up</h2>
          <ul className="flex flex-col gap-2">
            {plan.map((transfer) => (
              <li key={`${transfer.fromId}-${transfer.toId}`}>
                <Link
                  to="/log"
                  search={{
                    kind: "settle",
                    from: transfer.fromId,
                    to: transfer.toId,
                    amount: (transfer.amountCents / 100).toFixed(2),
                  }}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4"
                >
                  <span className="text-sm">
                    {nameOf(people, transfer.fromId)} pays {nameOf(people, transfer.toId)}
                  </span>
                  <span className="font-medium tabular-nums">{formatMoney(transfer.amountCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="font-display text-2xl">Recent</h2>
          <Link to="/log" className="text-sm text-ember">
            Log something
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">
            Nothing in the book yet. Add a friend, then log the first bill.
          </p>
        ) : (
          <ul className="flex flex-col">
            {recent.map((entry) => (
              <li key={entry.id} className="flex items-baseline justify-between gap-3 border-b border-line py-3">
                <div className="min-w-0">
                  <p className="truncate">{entryTitle(entry, people)}</p>
                  <p className="text-sm text-muted">
                    {entry.note} · {formatDay(entry.at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}
