import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Alert, Field, PrimaryButton, fieldClass } from "@/components/ui";
import { useBook } from "@/lib/book-store";
import { confirmedCents, recordedCents } from "@/lib/jars";
import { formatMoney, parseMoneyToCents } from "@/lib/money";

export const Route = createFileRoute("/jars/")({ component: JarsPage });

function JarsPage() {
  const book = useBook();
  const createJar = useBook((state) => state.createJar);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");

  function save() {
    const cents = parseMoneyToCents(goal);
    if (!cents) {
      setError("Set a goal like 40.00.");
      return;
    }
    const reason = createJar(name, cents);
    setError(reason ?? "");
    if (!reason) {
      setName("");
      setGoal("");
    }
  }

  return (
    <Shell>
      <header className="mb-5">
        <p className="text-xs font-medium tracking-widest text-ember uppercase">Shared jar</p>
        <h1 className="mt-2 font-display text-4xl">A pot for the circle</h1>
        <p className="mt-2 text-sm text-muted">
          Friends can be written into a jar, with a goal and a history. Amounts you record are promises, not a balance anyone can spend. Who legally holds real money is still undecided.
        </p>
      </header>

      <form
        className="mb-6 flex flex-col gap-3 rounded-3xl border border-line bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Field label="Jar name">
          <input className={fieldClass} value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Friday groceries" />
        </Field>
        <Field label="Goal">
          <input inputMode="decimal" className={fieldClass} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="40.00" />
        </Field>
        {error ? <Alert>{error}</Alert> : null}
        <PrimaryButton type="submit">Create jar</PrimaryButton>
      </form>

      {book.jars.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">No jars yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {book.jars.map((jar) => (
            <li key={jar.id}>
              <Link to="/jars/$jarId" params={{ jarId: jar.id }} className="block rounded-2xl border border-line bg-card px-4 py-3">
                <span className="font-medium">{jar.name}</span>
                <span className="mt-1 block text-sm text-muted">
                  Recorded {formatMoney(recordedCents(book, jar.id))} of {formatMoney(jar.goalCents)} goal · Confirmed{" "}
                  {formatMoney(confirmedCents(book, jar.id))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
