import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Alert, Field, PrimaryButton, QuietButton, fieldClass } from "@/components/ui";
import { parseBook } from "@/lib/book";
import { useBook } from "@/lib/book-store";

export const Route = createFileRoute("/people")({ component: PeoplePage });

function PeoplePage() {
  const book = useBook();
  const addPerson = useBook((state) => state.addPerson);
  const renamePerson = useBook((state) => state.renamePerson);
  const removePerson = useBook((state) => state.removePerson);
  const replaceBook = useBook((state) => state.replaceBook);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function add() {
    const reason = addPerson(name, "");
    setError(reason ?? "");
    if (!reason) setName("");
  }

  function download() {
    const snapshot = {
      people: book.people,
      loans: book.loans,
      repayments: book.repayments,
      jars: book.jars,
      members: book.members,
      contributions: book.contributions,
      withdrawals: book.withdrawals,
      audit: book.audit,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "between-us-book.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseBook(JSON.parse(await file.text()));
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      replaceBook(parsed.value);
      setError("");
    } catch {
      setError("That file could not be read.");
    }
  }

  return (
    <Shell>
      <header className="mb-5">
        <p className="text-xs font-medium tracking-widest text-ember uppercase">Circle</p>
        <h1 className="mt-2 font-display text-4xl">The friends in the book</h1>
        <p className="mt-2 text-sm text-muted">
          Names live on this device. They are not accounts, and they are not the Circle payments company.
        </p>
      </header>
      <ul className="mb-4 flex flex-col gap-2">
        {book.people.map((person) => (
          <li key={person.id} className="rounded-2xl border border-line bg-card p-3">
            <label className="block">
              <span className="sr-only">Name</span>
              <input
                className="h-11 w-full bg-transparent font-medium outline-none"
                defaultValue={person.name}
                key={person.name}
                maxLength={40}
                onBlur={(event) => {
                  const reason = renamePerson(person.id, event.target.value);
                  setError(reason ?? "");
                }}
              />
            </label>
            <p className="text-sm text-muted">{person.isYou ? "Record keeper on this device" : "Friend"}</p>
            {person.isYou ? null : (
              <button type="button" className="mt-1 h-10 text-sm text-muted" onClick={() => setError(removePerson(person.id) ?? "")}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mb-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <Field label="Add a friend">
          <input className={fieldClass} value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Maya" />
        </Field>
        <PrimaryButton type="submit" className="sm:mt-6">
          Add
        </PrimaryButton>
      </form>
      {error ? <Alert>{error}</Alert> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <QuietButton type="button" onClick={download}>
          Download this book
        </QuietButton>
        <label className="inline-flex h-12 cursor-pointer items-center rounded-full border border-line bg-card px-4 text-sm">
          Replace from a file
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(event) => {
              void onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
    </Shell>
  );
}
