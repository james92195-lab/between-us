import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { PersonMark } from "@/components/marks";
import { Shell } from "@/components/shell";
import { balances, booksText, formatMoney } from "@/lib/ledger";
import { useLedger } from "@/lib/store";

export const Route = createFileRoute("/circle")({ component: CirclePage });

function CirclePage() {
  const people = useLedger((s) => s.people);
  const entries = useLedger((s) => s.entries);
  const addPerson = useLedger((s) => s.addPerson);
  const renamePerson = useLedger((s) => s.renamePerson);
  const removePerson = useLedger((s) => s.removePerson);
  const loadDemo = useLedger((s) => s.loadDemo);
  const startBlank = useLedger((s) => s.startBlank);
  const circle = useLedger(
    useShallow((s) => ({
      people: s.people,
      entries: s.entries,
      causeName: s.causeName,
      goalCents: s.goalCents,
      offer: s.offer,
    })),
  );
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"blank" | "demo" | null>(null);
  const [copied, setCopied] = useState(false);
  const bal = balances(people, entries);

  function add() {
    const reason = addPerson(name);
    if (reason) {
      setError(reason);
      return;
    }
    setName("");
    setError("");
  }

  async function copyBooks() {
    const text = booksText(circle);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
      setError("Couldn’t copy. Select the books below instead.");
    }
  }

  return (
    <Shell>
      <header className="mb-5">
        <p className="text-xs font-medium tracking-widest text-ember uppercase">Circle</p>
        <h1 className="mt-2 font-display text-4xl">Who’s in it</h1>
        <p className="mt-2 text-muted">Names stay on this device. Nothing here is an account.</p>
      </header>

      <ul className="mb-5 flex flex-col gap-2">
        {people.map((person) => {
          const cents = bal[person.id] ?? 0;
          return (
            <li key={person.id} className="rounded-2xl border border-line bg-card p-3">
              <div className="flex items-center gap-3">
                <PersonMark name={person.name} you={person.isYou} />
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Name</span>
                  <input
                    defaultValue={person.name}
                    key={person.name}
                    maxLength={24}
                    onBlur={(event) => renamePerson(person.id, event.target.value)}
                    className="h-11 w-full bg-transparent font-medium outline-none"
                  />
                </label>
                <p className="text-sm tabular-nums text-muted">
                  {cents === 0 ? "Square" : formatMoney(Math.abs(cents))}
                </p>
              </div>
              {!person.isYou && (
                <button
                  type="button"
                  onClick={() => {
                    const reason = removePerson(person.id);
                    setError(reason ?? "");
                  }}
                  className="mt-1 h-10 px-1 text-sm text-muted"
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <form
        className="mb-6 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Add a friend"
          maxLength={24}
          className="h-12 min-w-0 flex-1 rounded-full border border-line bg-card px-4"
        />
        <button type="submit" className="h-12 shrink-0 rounded-full bg-ink px-5 text-paper">
          Add
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-ember">{error}</p>}

      <section className="mb-6">
        <h2 className="font-display text-2xl">The books</h2>
        <p className="mt-1 mb-3 text-sm text-muted">A plain copy you can paste into a note, a text, or a GitHub file.</p>
        <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-sm leading-relaxed whitespace-pre-wrap text-paper">
          {booksText(circle)}
        </pre>
        <button type="button" onClick={() => void copyBooks()} className="mt-3 h-11 rounded-full border border-ink px-5 text-sm">
          {copied ? "Copied" : "Copy the books"}
        </button>
      </section>

      <section>
        <h2 className="font-display text-2xl">Start over</h2>
        <p className="mt-1 mb-3 text-sm text-muted">This only clears the copy on this device.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConfirm("demo")} className="h-11 rounded-full border border-line bg-card px-4 text-sm">
            Load the sample circle
          </button>
          <button type="button" onClick={() => setConfirm("blank")} className="h-11 rounded-full border border-line bg-card px-4 text-sm">
            Start blank
          </button>
        </div>
        {confirm && (
          <div className="mt-3 rounded-2xl border border-line bg-card p-4">
            <p className="text-sm">
              {confirm === "blank" ? "Replace this ledger with just you?" : "Replace this ledger with Maya, Jonah, and Priya?"}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="h-11 rounded-full bg-ember px-4 text-sm text-paper"
                onClick={() => {
                  if (confirm === "blank") startBlank();
                  else loadDemo();
                  setConfirm(null);
                  setError("");
                }}
              >
                Replace it
              </button>
              <button type="button" className="h-11 rounded-full px-4 text-sm" onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </Shell>
  );
}
