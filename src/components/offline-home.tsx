import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { useBook } from "@/lib/book-store";
import { confirmedCents, recordedCents } from "@/lib/jars";
import { loanStanding, positionCents, remainingCents } from "@/lib/loans";
import { formatMoney } from "@/lib/money";

export function OfflineHome() {
  const book = useBook();
  const you = book.people.find((person) => person.isYou) ?? book.people[0];
  const position = you ? positionCents(book, you.id) : { owedToThem: 0, theyOwe: 0 };
  const net = position.owedToThem - position.theyOwe;
  const today = new Date().toISOString().slice(0, 10);
  const openLoans = book.loans.filter(
    (loan) => loanStanding(loan, book, today) === "open" || loanStanding(loan, book, today) === "overdue",
  );

  return (
    <Shell>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-widest text-ember uppercase">Offline notebook</p>
        <h1 className="mt-2 font-display text-4xl">{net === 0 ? "The book is quiet" : net > 0 ? "You’re owed" : "You owe"}</h1>
        {net !== 0 ? <p className="mt-1 font-display text-5xl tabular-nums">{formatMoney(Math.abs(net))}</p> : null}
        <p className="mt-3 max-w-md text-sm text-muted">
          This notebook stays in this browser. It is not sign-in, and a yes here does not approve a shared jar.
        </p>
      </header>
      <section className="mb-4 grid gap-3 sm:grid-cols-2">
        <Link to="/loans" className="rounded-3xl border border-line bg-card p-4">
          <p className="text-xs tracking-widest text-ember uppercase">Loans</p>
          <p className="mt-2 font-display text-3xl">{openLoans.length}</p>
          <p className="text-sm text-muted">Open or past due. Interest stays at zero.</p>
        </Link>
        <Link to="/jars" className="rounded-3xl border border-line bg-ink p-4 text-paper">
          <p className="text-xs tracking-widest text-paper/70 uppercase">Jars</p>
          <p className="mt-2 font-display text-3xl">{book.jars.length}</p>
          <p className="text-sm text-paper/75">Recorded promises, not a wallet.</p>
        </Link>
      </section>
      <section>
        <h2 className="mb-2 font-display text-2xl">Open loans</h2>
        {openLoans.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
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
        <p className="mt-4 text-sm text-muted">
          Jar promises on this device: {book.jars.map((jar) => `${jar.name} recorded ${formatMoney(recordedCents(book, jar.id))}, confirmed ${formatMoney(confirmedCents(book, jar.id))}`).join("; ") || "none"}.
        </p>
      </section>
    </Shell>
  );
}
