import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { buildExpense, formatMoney, nameOf, parseDollars } from "@/lib/ledger";
import { useLedger } from "@/lib/store";
import { cn } from "@/lib/cn";

type Kind = "expense" | "settle" | "drop";

type LogSearch = {
  kind?: Kind;
  amount?: string;
  from?: string;
  to?: string;
};

export const Route = createFileRoute("/log")({
  validateSearch: (search: Record<string, unknown>): LogSearch => ({
    kind: search.kind === "settle" || search.kind === "drop" || search.kind === "expense" ? search.kind : undefined,
    amount: typeof search.amount === "string" ? search.amount : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
  }),
  component: LogPage,
});

function LogPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const people = useLedger((s) => s.people);
  const logExpense = useLedger((s) => s.logExpense);
  const logSettle = useLedger((s) => s.logSettle);
  const logDrop = useLedger((s) => s.logDrop);
  const you = people.find((person) => person.isYou) ?? people[0];

  const [kind, setKind] = useState<Kind>(search.kind ?? "expense");
  const [amount, setAmount] = useState(search.amount ?? "");
  const [note, setNote] = useState("");
  const [payerId, setPayerId] = useState(you?.id ?? "");
  const [members, setMembers] = useState<string[]>(people.map((person) => person.id));
  const [fromId, setFromId] = useState(search.from && people.some((p) => p.id === search.from) ? search.from : (you?.id ?? ""));
  const [toId, setToId] = useState(
    search.to && people.some((p) => p.id === search.to) ? search.to : (people.find((p) => p.id !== you?.id)?.id ?? you?.id ?? ""),
  );
  const [dropId, setDropId] = useState(you?.id ?? "");
  const [roundUp, setRoundUp] = useState(true);
  const [error, setError] = useState("");

  const cents = parseDollars(amount);
  const orderedMembers = people.map((person) => person.id).filter((id) => members.includes(id) || id === payerId);

  const preview =
    kind === "expense" && cents && orderedMembers.length > 0
      ? buildExpense({
          id: "draft",
          at: 0,
          note,
          payerId,
          totalCents: cents,
          memberIds: orderedMembers,
          roundUp,
        })
      : null;

  function save() {
    if (!cents) {
      setError("Enter an amount like 18.50.");
      return;
    }
    if (kind === "expense") {
      if (!payerId || orderedMembers.length === 0) {
        setError("Pick who paid.");
        return;
      }
      logExpense({ note, payerId, totalCents: cents, memberIds: orderedMembers, roundUp });
    } else if (kind === "settle") {
      if (!fromId || !toId || fromId === toId) {
        setError("Pick two different people.");
        return;
      }
      logSettle({ note, fromId, toId, amountCents: cents });
    } else {
      if (!dropId) {
        setError("Pick who dropped the change.");
        return;
      }
      logDrop({ note, personId: dropId, amountCents: cents });
    }
    void navigate({ to: "/" });
  }

  return (
    <Shell>
      <header className="mb-5">
        <p className="text-xs font-medium tracking-widest text-ember uppercase">Log</p>
        <h1 className="mt-2 font-display text-4xl">What happened</h1>
      </header>

      <div className="mb-5 grid grid-cols-3 gap-2 rounded-full bg-paper-deep p-1">
        {(
          [
            ["expense", "Bill"],
            ["settle", "Payback"],
            ["drop", "Change"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setKind(value);
              setError("");
            }}
            className={cn(
              "h-11 rounded-full text-sm",
              kind === value ? "bg-ink text-paper" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm text-muted">Amount</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
          className="h-16 w-full rounded-2xl border border-line bg-card px-4 font-display text-4xl tabular-nums outline-none"
        />
      </label>

      <label className="mb-5 block">
        <span className="mb-1 block text-sm text-muted">Note</span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={80}
          placeholder={kind === "expense" ? "Dinner, groceries, tickets" : kind === "settle" ? "Payback" : "Loose change"}
          className="h-12 w-full rounded-2xl border border-line bg-card px-4 outline-none"
        />
      </label>

      {kind === "expense" && (
        <>
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm text-muted">Who paid</legend>
            <div className="flex flex-wrap gap-2">
              {people.map((person) => (
                <Chip
                  key={person.id}
                  pressed={payerId === person.id}
                  onClick={() => {
                    setPayerId(person.id);
                    setMembers((current) => (current.includes(person.id) ? current : [...current, person.id]));
                  }}
                  label={person.name}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm text-muted">Split equally with</legend>
            <div className="flex flex-wrap gap-2">
              {people.map((person) => {
                const locked = person.id === payerId;
                const on = locked || members.includes(person.id);
                return (
                  <Chip
                    key={person.id}
                    pressed={on}
                    disabled={locked}
                    onClick={() =>
                      setMembers((current) =>
                        current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id],
                      )
                    }
                    label={person.name}
                  />
                );
              })}
            </div>
          </fieldset>
          <button
            type="button"
            role="switch"
            aria-checked={roundUp}
            onClick={() => setRoundUp((value) => !value)}
            className="mb-4 flex min-h-14 w-full items-center justify-between rounded-2xl border border-line bg-card px-4 text-left"
          >
            <span>
              <span className="block font-medium">Round up into the jar</span>
              <span className="block text-sm text-muted">Each share goes up to the next dollar. The extra is the jar’s.</span>
            </span>
            <span className={cn("ml-3 h-7 w-12 shrink-0 rounded-full p-1", roundUp ? "bg-ember" : "bg-paper-deep")}>
              <span className={cn("block size-5 rounded-full bg-card", roundUp && "ml-auto")} />
            </span>
          </button>
          {preview && preview.kind === "expense" && (
            <div className="mb-4 rounded-2xl bg-paper-deep px-4 py-3 text-sm">
              <ul className="flex flex-col gap-1">
                {preview.shares
                  .filter((share) => share.personId !== preview.payerId)
                  .map((share) => (
                    <li key={share.personId}>
                      {nameOf(people, share.personId)} owes {nameOf(people, preview.payerId)} {formatMoney(share.shareCents)}
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-muted">
                Jar takes{" "}
                {formatMoney(preview.shares.reduce((sum, share) => sum + share.roundupCents, 0))}
                {roundUp ? "" : " — round-up is off"}.
              </p>
            </div>
          )}
        </>
      )}

      {kind === "settle" && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Select label="From" value={fromId} onChange={setFromId} people={people} />
          <Select label="To" value={toId} onChange={setToId} people={people} />
        </div>
      )}

      {kind === "drop" && (
        <div className="mb-4">
          <Select label="Who dropped it" value={dropId} onChange={setDropId} people={people} />
        </div>
      )}

      {error && <p className="mb-3 text-sm text-ember">{error}</p>}

      <button type="button" onClick={save} className="h-12 w-full rounded-full bg-ember font-medium text-paper">
        Save to the ledger
      </button>
    </Shell>
  );
}

function Chip({
  pressed,
  onClick,
  label,
  disabled,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-11 rounded-full border px-4 text-sm",
        pressed ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink",
      )}
    >
      {label}
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  people,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  people: { id: string; name: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-line bg-card px-3"
      >
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
    </label>
  );
}
