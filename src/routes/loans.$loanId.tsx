import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Alert, Field, PrimaryButton, QuietButton, fieldClass } from "@/components/ui";
import { useBook } from "@/lib/book-store";
import { loanStanding, loanTitle, remainingCents } from "@/lib/loans";
import { formatDay, formatMoney, parseMoneyToCents } from "@/lib/money";

export const Route = createFileRoute("/loans/$loanId")({ component: LoanDetail });

function LoanDetail() {
  const { loanId } = Route.useParams();
  const book = useBook();
  const recordRepayment = useBook((state) => state.recordRepayment);
  const voidLoan = useBook((state) => state.voidLoan);
  const loan = book.loans.find((row) => row.id === loanId);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  if (!loan) {
    return (
      <Shell>
        <h1 className="font-display text-4xl">Loan not found</h1>
        <p className="mt-2 text-sm text-muted">It isn’t in the book on this device.</p>
        <Link to="/loans" className="mt-4 inline-flex text-ember">
          Back to loans
        </Link>
      </Shell>
    );
  }
  const current = loan;

  const standing = loanStanding(loan, book, today);
  const left = remainingCents(loan, book);
  const history = book.repayments.filter((row) => row.loanId === current.id);

  function save() {
    const cents = parseMoneyToCents(amount);
    if (!cents) {
      setError("Enter an amount like 10.00.");
      return;
    }
    const reason = recordRepayment(current.id, cents, note);
    setError(reason ?? "");
    if (!reason) {
      setAmount("");
      setNote("");
    }
  }

  return (
    <Shell>
      <p className="text-xs font-medium tracking-widest text-ember uppercase">{standing}</p>
      <h1 className="mt-2 font-display text-4xl">{loanTitle(book, loan)}</h1>
      <p className="mt-2 font-display text-5xl tabular-nums">{formatMoney(left)}</p>
      <p className="mt-2 text-sm text-muted">
        Principal {formatMoney(current.principalCents)}
        {current.dueOn ? ` · due ${current.dueOn}` : ""}. {current.note}
      </p>

      {standing === "open" || standing === "overdue" ? (
        <form
          className="mt-6 flex flex-col gap-3 rounded-3xl border border-line bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <h2 className="font-display text-2xl">Write down a repayment</h2>
          <p className="text-sm text-muted">This only changes the book on this device. It does not confirm a bank payment.</p>
          <Field label="Amount">
            <input inputMode="decimal" className={fieldClass} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="10.00" />
          </Field>
          <Field label="Note">
            <input className={fieldClass} value={note} maxLength={120} onChange={(event) => setNote(event.target.value)} placeholder="Cash" />
          </Field>
          {error ? <Alert>{error}</Alert> : null}
          <PrimaryButton type="submit">Record repayment</PrimaryButton>
        </form>
      ) : null}

      <h2 className="mt-6 mb-2 font-display text-2xl">History</h2>
      {history.length === 0 ? <p className="text-sm text-muted">No repayments yet.</p> : null}
      <ul>
        {history.map((row) => (
          <li key={row.id} className="flex items-baseline justify-between gap-3 border-b border-line py-3">
            <span>
              <span className="block">{row.note}</span>
              <span className="text-sm text-muted">Written down · {formatDay(row.at)}</span>
            </span>
            <span className="tabular-nums">{formatMoney(row.amountCents)}</span>
          </li>
        ))}
      </ul>

      {standing === "open" || standing === "overdue" ? (
        <QuietButton
          type="button"
          className="mt-6"
          onClick={() => {
            const reason = voidLoan(current.id);
            setError(reason ?? "");
          }}
        >
          Void this loan
        </QuietButton>
      ) : null}
    </Shell>
  );
}
