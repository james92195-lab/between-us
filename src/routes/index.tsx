import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { formatMoney } from "@/lib/money";
import { useBook } from "@/lib/book-store";
import { confirmedCents, recordedCents } from "@/lib/jars";
import { loanStanding, positionCents, remainingCents } from "@/lib/loans";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const book = useBook();
  const you = book.people.find((person) => person.isYou) ?? book.people[0];
  const position = you ? positionCents(book, you.id) : { owedToThem: 0, theyOwe: 0 };
  const net = position.owedToThem - position.theyOwe;
  const today = new Date().toISOString().slice(0, 10);
  const openLoans = book.loans.filter((loan) => loanStanding(loan, book, today) === "open" || loanStanding(loan, book, today) === "overdue");

  return (
    <Shell>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-widest text-ember uppercase">This device</p>
        <h1 className="mt-2 font-display text-4xl">{net === 0 ? "The book is quiet" : net > 0 ? "You’re owed" : "You owe"}</h1>
        {net !== 0 ? <p className="mt-1 font-display text-5xl tabular-nums">{formatMoney(Math.abs(net))}</p> : null}
        <p className="mt-3 max-w-md text-sm text-muted">
          Loans and jar votes stay in this browser. Friends do not share a login here, and nothing on this page sends money.
        </p>
      </header>

      <section className="mb-4 grid gap-3 sm:grid-cols-2">
        <Link to="/loans" className="rounded-3xl border border-line bg-card p-4">
          <p className="text-xs tracking-widest text-ember uppercase">Loans</p>
          <p className="mt-2 font-display text-3xl">{openLoans.length}</p>
          <p className="text-sm text-muted">Open or past due. Interest stays at zero.</p>
        </Link>
        <Link to="/jars" className="rounded-3xl border border-line bg-ink p-4 text-paper">
          <p className="text-xs tracking-widest text-paper/70 uppercase">Shared jars</p>
          <p className="mt-2 font-display text-3xl">{book.jars.length}</p>
          <p className="text-sm text-paper/75">Recorded promises, not a wallet.</p>
        </Link>
      </section>

      {book.jars.length === 0 ? (
        <p className="mb-6 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">
          No shared jar yet. Open one, add the circle, and write down who promised what. Withdrawals need three other active members, and even then the money stays put.
        </p>
      ) : (
        <ul className="mb-6 flex flex-col gap-2">
          {book.jars.map((jar) => (
            <li key={jar.id}>
              <Link to="/jars/$jarId" params={{ jarId: jar.id }} className="block rounded-2xl border border-line bg-card px-4 py-3">
                <span className="font-medium">{jar.name}</span>
                <span className="mt-1 block text-sm text-muted">
                  Recorded {formatMoney(recordedCents(book, jar.id))} · Confirmed {formatMoney(confirmedCents(book, jar.id))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section>
        <h2 className="mb-2 font-display text-2xl">Open loans</h2>
        {openLoans.length === 0 ? (
          <p className="text-sm text-muted">None yet. A loan here is a record of who lent whom, not a payment.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {openLoans.map((loan) => (
              <li key={loan.id}>
                <Link to="/loans/$loanId" params={{ loanId: loan.id }} className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
                  <span className="text-sm">
                    {book.people.find((person) => person.id === loan.lenderId)?.name} lent{" "}
                    {book.people.find((person) => person.id === loan.borrowerId)?.name}
                  </span>
                  <span className="font-medium tabular-nums">{formatMoney(remainingCents(loan, book))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}
