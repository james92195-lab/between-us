import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { JarArt } from "@/components/marks";
import { Shell } from "@/components/shell";
import { entryTitle, formatDay, formatMoney, jarCents, jarDelta, parseDollars } from "@/lib/ledger";
import { useLedger } from "@/lib/store";

export const Route = createFileRoute("/jar")({ component: JarPage });

function JarPage() {
  const entries = useLedger((s) => s.entries);
  const people = useLedger((s) => s.people);
  const causeName = useLedger((s) => s.causeName);
  const goalCents = useLedger((s) => s.goalCents);
  const setCause = useLedger((s) => s.setCause);
  const donate = useLedger((s) => s.donate);
  const jar = jarCents(entries);
  const [cause, setCauseDraft] = useState(causeName);
  const [goal, setGoal] = useState((goalCents / 100).toFixed(2));
  const [gift, setGift] = useState(jar > 0 ? (jar / 100).toFixed(2) : "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    setCauseDraft(causeName);
    setGoal((goalCents / 100).toFixed(2));
  }, [causeName, goalCents]);

  const history = [...entries].filter((entry) => jarDelta(entry) !== 0).sort((a, b) => b.at - a.at);

  function saveCause() {
    const cents = parseDollars(goal);
    if (!cause.trim() || !cents) {
      setError("Name the cause and set a goal above zero.");
      return;
    }
    setError("");
    setCause(cause.trim(), cents);
    setSaved("Cause saved.");
  }

  function give() {
    const cents = parseDollars(gift);
    if (!cents) {
      setError("Enter how much to give.");
      return;
    }
    const reason = donate(cents, note);
    if (reason) {
      setError(reason);
      return;
    }
    setError("");
    setNote("");
    setSaved("Marked as given. Hand the cash over however you already do.");
    setGift("");
  }

  return (
    <Shell>
      <header className="mb-5">
        <p className="text-xs font-medium tracking-widest text-ember uppercase">Change jar</p>
        <h1 className="mt-2 font-display text-4xl tabular-nums">{formatMoney(Math.max(0, jar))}</h1>
        <p className="mt-2 text-muted">Round-ups and dropped coins. Not a bank — you still hold the cash.</p>
      </header>

      <div className="mb-6 rounded-3xl border border-line bg-card px-4 py-6">
        <JarArt ratio={goalCents > 0 ? jar / goalCents : 0} />
        <p className="mt-4 text-center text-sm text-muted">
          {formatMoney(Math.max(0, jar))} of {formatMoney(goalCents)} for {causeName}
        </p>
      </div>

      <section className="mb-6 rounded-3xl border border-line bg-card p-4">
        <h2 className="font-display text-2xl">The cause</h2>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm text-muted">Name</span>
          <input
            value={cause}
            onChange={(event) => setCauseDraft(event.target.value)}
            maxLength={60}
            className="h-12 w-full rounded-2xl border border-line bg-paper px-4"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm text-muted">Goal</span>
          <input
            inputMode="decimal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            className="h-12 w-full rounded-2xl border border-line bg-paper px-4 tabular-nums"
          />
        </label>
        <button type="button" onClick={saveCause} className="mt-3 h-11 rounded-full border border-ink px-5 text-sm">
          Save cause
        </button>
      </section>

      <section className="mb-6">
        <h2 className="font-display text-2xl">Give it</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          Recording a gift doesn’t move money. It clears the jar after you’ve actually donated.
        </p>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-muted">Amount</span>
          <input
            inputMode="decimal"
            value={gift}
            onChange={(event) => setGift(event.target.value)}
            placeholder="0.00"
            className="h-12 w-full rounded-2xl border border-line bg-card px-4 tabular-nums"
          />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-muted">Note</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={80}
            placeholder="Left it at the fridge"
            className="h-12 w-full rounded-2xl border border-line bg-card px-4"
          />
        </label>
        <button
          type="button"
          onClick={give}
          disabled={jar <= 0}
          className="h-12 w-full rounded-full bg-ember font-medium text-paper disabled:opacity-40"
        >
          Mark as given
        </button>
      </section>

      {error && <p className="mb-3 text-sm text-ember">{error}</p>}
      {saved && !error && <p className="mb-3 text-sm text-muted">{saved}</p>}

      <section>
        <h2 className="mb-2 font-display text-2xl">Jar book</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">Nothing in the jar yet.</p>
        ) : (
          <ul>
            {history.map((entry) => {
              const delta = jarDelta(entry);
              return (
                <li key={entry.id} className="flex items-baseline justify-between gap-3 border-b border-line py-3">
                  <div className="min-w-0">
                    <p className="truncate">{entryTitle(entry, people)}</p>
                    <p className="text-sm text-muted">
                      {entry.note} · {formatDay(entry.at)}
                    </p>
                  </div>
                  <p className="shrink-0 tabular-nums">{delta > 0 ? `+${formatMoney(delta)}` : formatMoney(delta)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Shell>
  );
}
