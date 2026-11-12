import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Alert, Field, PrimaryButton, fieldClass } from "@/components/ui";
import { useBook } from "@/lib/book-store";
import { loanStanding, loanTitle, remainingCents } from "@/lib/loans";
import { formatMoney, parseMoneyToCents } from "@/lib/money";

export const Route = createFileRoute("/loans/")({ component: LoansPage });

function LoansPage() {
  const book = useBook();
  const createLoan = useBook((state) => state.createLoan);
  const you = book.people.find((person) => person.isYou);
  const [lenderId, setLenderId] = useState(you?.id ?? "");
  const [borrowerId, setBorrowerId] = useState(book.people.find((person) => !person.isYou)?.id ?? "");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  function save() {
    const cents = parseMoneyToCents(amount);
    if (!cents) {
      setError("Enter an amount like 25.50.");
      return;
    }
    const reason = createLoan({
      lenderId,
      borrowerId,
      principalCents: cents,
      dueOn: dueOn || null,
      note,
    });
    setError(reason ?? "");
    if (!reason) {
      setAmount("");
      setNote("");
    }
  }

  return (
    <Shell>
      <header className="mb-5">
        <p className="text-xs font-medium tracking-widest text-ember uppercase">Loans</p>
        <h1 className="mt-2 font-display text-4xl">Who lent what</h1>
        <p className="mt-2 text-sm text-muted">
          Interest is zero. A repayment you type is written down by hand. It is not a bank confirmation.
        </p>
      </header>

      {book.people.length < 2 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">
          Add another person in the circle before you record a loan.
        </p>
      ) : (
        <form
          className="mb-6 flex flex-col gap-3 rounded-3xl border border-line bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Lender">
              <select className={fieldClass} value={lenderId} onChange={(event) => setLenderId(event.target.value)}>
                {book.people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Borrower">
              <select className={fieldClass} value={borrowerId} onChange={(event) => setBorrowerId(event.target.value)}>
                {book.people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Amount">
            <input inputMode="decimal" className={fieldClass} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="25.50" />
          </Field>
          <Field label="Due date, optional">
            <input type="date" className={fieldClass} value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
          </Field>
          <Field label="Note">
            <input className={fieldClass} value={note} maxLength={120} onChange={(event) => setNote(event.target.value)} placeholder="Concert tickets" />
          </Field>
          {error ? <Alert>{error}</Alert> : null}
          <PrimaryButton type="submit">Record loan</PrimaryButton>
        </form>
      )}

      <ul className="flex flex-col gap-2">
        {book.loans.length === 0 ? <li className="text-sm text-muted">No loans in the book.</li> : null}
        {book.loans.map((loan) => (
          <li key={loan.id}>
            <Link to="/loans/$loanId" params={{ loanId: loan.id }} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
              <span>
                <span className="block font-medium">{loanTitle(book, loan)}</span>
                <span className="text-sm text-muted">{loanStanding(loan, book, today)} · {loan.note}</span>
              </span>
              <span className="font-medium tabular-nums">{formatMoney(remainingCents(loan, book))}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
