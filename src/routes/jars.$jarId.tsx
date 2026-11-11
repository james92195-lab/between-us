import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Alert, Field, PrimaryButton, QuietButton, fieldClass } from "@/components/ui";
import { personName } from "@/lib/book";
import { useBook } from "@/lib/book-store";
import {
  APPROVALS_REQUIRED,
  confirmedCents,
  eligibleApproverIds,
  recordedCents,
  standingLabel,
  validApproverIds,
  withdrawalStanding,
} from "@/lib/jars";
import { formatDay, formatMoney, parseMoneyToCents } from "@/lib/money";

export const Route = createFileRoute("/jars/$jarId")({ component: JarDetail });

function JarDetail() {
  const { jarId } = Route.useParams();
  const book = useBook();
  const jar = book.jars.find((row) => row.id === jarId);
  const addMember = useBook((state) => state.addJarMember);
  const setStatus = useBook((state) => state.setMemberStatus);
  const recordContribution = useBook((state) => state.recordContribution);
  const createWithdrawal = useBook((state) => state.createWithdrawal);
  const editWithdrawal = useBook((state) => state.editWithdrawal);
  const approve = useBook((state) => state.approveWithdrawal);
  const reject = useBook((state) => state.rejectWithdrawal);
  const cancel = useBook((state) => state.cancelWithdrawal);
  const checkSend = useBook((state) => state.checkWithdrawalSend);
  const [error, setError] = useState("");
  const [memberId, setMemberId] = useState("");
  const [contribPerson, setContribPerson] = useState("");
  const [contribAmount, setContribAmount] = useState("");
  const [contribNote, setContribNote] = useState("");
  const [requesterId, setRequesterId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [voterId, setVoterId] = useState("");

  if (!jar) {
    return (
      <Shell>
        <h1 className="font-display text-4xl">Jar not found</h1>
        <Link to="/jars" className="mt-4 inline-flex text-ember">
          Back to jars
        </Link>
      </Shell>
    );
  }
  const current = jar;

  const members = book.members.filter((member) => member.jarId === current.id);
  const active = members.filter((member) => member.status === "active");
  const outsiders = book.people.filter((person) => !members.some((member) => member.personId === person.id && member.status === "active"));
  const contributions = book.contributions.filter((row) => row.jarId === current.id);
  const withdrawals = book.withdrawals.filter((row) => row.jarId === current.id);
  const audit = book.audit.filter((event) => event.jarId === current.id).slice().reverse();
  const recorded = recordedCents(book, current.id);
  const confirmed = confirmedCents(book, current.id);

  function onAddMember() {
    if (!memberId) {
      setError("Pick a person from the circle.");
      return;
    }
    setError(addMember(current.id, memberId) ?? "");
  }

  function onContribute() {
    const cents = parseMoneyToCents(contribAmount);
    if (!cents) {
      setError("Enter an amount like 5.00.");
      return;
    }
    const reason = recordContribution(current.id, contribPerson || active[0]?.personId || "", cents, contribNote);
    setError(reason ?? "");
    if (!reason) {
      setContribAmount("");
      setContribNote("");
    }
  }

  function onRequest() {
    const cents = parseMoneyToCents(withdrawAmount);
    if (!cents) {
      setError("Enter an amount like 20.00.");
      return;
    }
    const reason = createWithdrawal({
      jarId: current.id,
      requesterId: requesterId || active[0]?.personId || "",
      amountCents: cents,
      destinationPersonId: destinationId || book.people[0]?.id || "",
      purpose,
    });
    setError(reason ?? "");
    if (!reason) {
      setWithdrawAmount("");
      setPurpose("");
    }
  }

  return (
    <Shell>
      <p className="text-xs font-medium tracking-widest text-ember uppercase">Shared jar</p>
      <h1 className="mt-2 font-display text-4xl">{jar.name}</h1>
      <p className="mt-2 text-sm text-muted">
        Custody is undecided. This is not a wallet, and confirmed funds are {formatMoney(confirmed)}.
      </p>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-line bg-card p-4">
          <p className="text-xs tracking-widest text-muted uppercase">Recorded promises</p>
          <p className="mt-1 font-display text-4xl tabular-nums">{formatMoney(recorded)}</p>
          <p className="text-sm text-muted">Toward a {formatMoney(jar.goalCents)} goal. Not received.</p>
        </div>
        <div className="rounded-3xl border border-line bg-card p-4">
          <p className="text-xs tracking-widest text-muted uppercase">Provider-confirmed</p>
          <p className="mt-1 font-display text-4xl tabular-nums">{formatMoney(confirmed)}</p>
          <p className="text-sm text-muted">Only a verified bank event could raise this. None has.</p>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-ink p-4 text-paper">
        <h2 className="font-display text-2xl">Withdrawal rule</h2>
        <p className="mt-2 text-sm text-paper/80">
          {APPROVALS_REQUIRED} other active members of this jar must each record a yes for the same amount, currency, destination, purpose, and jar. The requester cannot approve themselves. Fewer than {APPROVALS_REQUIRED} eligible people blocks the vote. The number does not shrink. Three yeses mean the policy is met on this device. They do not send money.
        </p>
      </section>

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="font-display text-2xl">Members</h2>
        <p className="mb-3 text-sm text-muted">{active.length} active. Circle friends who have not joined this jar cannot vote.</p>
        <ul className="mb-3 flex flex-col gap-2">
          {members.map((member) => (
            <li key={member.personId} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-3 py-2">
              <span>
                <span className="block font-medium">{personName(book, member.personId)}</span>
                <span className="text-sm text-muted">{member.status === "active" ? "Active member" : "Inactive"}</span>
              </span>
              <QuietButton
                type="button"
                onClick={() =>
                  setError(
                    setStatus(current.id, member.personId, member.status === "active" ? "inactive" : "active") ?? "",
                  )
                }
              >
                {member.status === "active" ? "Mark inactive" : "Mark active"}
              </QuietButton>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className={fieldClass} value={memberId} onChange={(event) => setMemberId(event.target.value)} aria-label="Person to add">
            <option value="">Add from the circle</option>
            {outsiders.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <PrimaryButton type="button" onClick={onAddMember}>
            Add member
          </PrimaryButton>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-2xl">Record a contribution</h2>
        <p className="mb-3 text-sm text-muted">This writes a promise. It does not deposit money.</p>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onContribute();
          }}
        >
          <Field label="Member">
            <select className={fieldClass} value={contribPerson} onChange={(event) => setContribPerson(event.target.value)}>
              {active.map((member) => (
                <option key={member.personId} value={member.personId}>
                  {personName(book, member.personId)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input inputMode="decimal" className={fieldClass} value={contribAmount} onChange={(event) => setContribAmount(event.target.value)} placeholder="5.00" />
          </Field>
          <Field label="Note">
            <input className={fieldClass} value={contribNote} maxLength={120} onChange={(event) => setContribNote(event.target.value)} />
          </Field>
          <PrimaryButton type="submit">Record promise</PrimaryButton>
        </form>
        <ul className="mt-3">
          {contributions.length === 0 ? <li className="text-sm text-muted">No contributions recorded.</li> : null}
          {contributions.map((row) => (
            <li key={row.id} className="flex items-baseline justify-between gap-3 border-b border-line py-3">
              <span>
                <span className="block">{personName(book, row.personId)} · {row.note}</span>
                <span className="text-sm text-muted">Recorded promise · {formatDay(row.at)}</span>
              </span>
              <span className="tabular-nums">{formatMoney(row.amountCents)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-2xl">Ask to withdraw</h2>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onRequest();
          }}
        >
          <Field label="Requester">
            <select className={fieldClass} value={requesterId} onChange={(event) => setRequesterId(event.target.value)}>
              {active.map((member) => (
                <option key={member.personId} value={member.personId}>
                  {personName(book, member.personId)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pay to, if a transfer were ever allowed">
            <select className={fieldClass} value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
              {book.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input inputMode="decimal" className={fieldClass} value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} placeholder="20.00" />
          </Field>
          <Field label="Purpose">
            <input className={fieldClass} value={purpose} maxLength={120} onChange={(event) => setPurpose(event.target.value)} placeholder="Groceries for the house" />
          </Field>
          <PrimaryButton type="submit">Create request</PrimaryButton>
        </form>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-display text-2xl">Requests</h2>
        <Field label="Record a vote as">
          <select className={fieldClass} value={voterId} onChange={(event) => setVoterId(event.target.value)}>
            <option value="">Choose a member on this device</option>
            {active.map((member) => (
              <option key={member.personId} value={member.personId}>
                {personName(book, member.personId)}
              </option>
            ))}
          </select>
        </Field>
        <p className="mt-2 text-sm text-muted">
          Picking a name here is a notebook entry. It is not that person’s login, and it cannot authorize funds.
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {withdrawals.length === 0 ? <li className="text-sm text-muted">No withdrawal requests.</li> : null}
          {withdrawals.map((request) => {
            const standing = withdrawalStanding(book, request);
            const yes = validApproverIds(book, request).length;
            const eligible = eligibleApproverIds(book, request).length;
            const latest = request.executionAttempts[request.executionAttempts.length - 1];
            return (
              <li key={request.id} className="rounded-3xl border border-line bg-card p-4">
                <p className="text-xs tracking-widest text-ember uppercase">{standingLabel(standing)}</p>
                <p className="mt-1 font-display text-3xl tabular-nums">{formatMoney(request.amountCents)}</p>
                <p className="text-sm text-muted">
                  {personName(book, request.requesterId)} asks to pay {personName(book, request.destinationPersonId)}. {request.purpose}. Version {request.revision}. {yes} of {APPROVALS_REQUIRED} yeses. {eligible} other active members can vote.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <QuietButton type="button" onClick={() => setError(voterId ? approve(request.id, voterId) ?? "" : "Choose who is recording the vote.")}>
                    Record yes
                  </QuietButton>
                  <QuietButton type="button" onClick={() => setError(voterId ? reject(request.id, voterId) ?? "" : "Choose who is recording the vote.")}>
                    Record no
                  </QuietButton>
                  <QuietButton type="button" onClick={() => setError(cancel(request.id, request.requesterId) ?? "")}>
                    Cancel request
                  </QuietButton>
                  <QuietButton
                    type="button"
                    onClick={() => {
                      const reason = checkSend(request.id);
                      setError(reason ?? "No transfer was created.");
                    }}
                  >
                    Check send status
                  </QuietButton>
                </div>
                {standing === "pending" || standing === "policy_approved" || standing === "blocked" ? (
                  <EditRow
                    amountCents={request.amountCents}
                    destinationId={request.destinationPersonId}
                    purpose={request.purpose}
                    people={book.people.map((person) => ({ id: person.id, name: person.name }))}
                    onSave={(next) => setError(editWithdrawal({ withdrawalId: request.id, ...next }) ?? "")}
                  />
                ) : null}
                {latest ? (
                  <p className="mt-3 text-sm text-muted">
                    Last check did not move money. {latest.reasons.join(", ")}.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-2xl">Audit</h2>
        {audit.length === 0 ? <p className="text-sm text-muted">Nothing recorded yet.</p> : null}
        <ul>
          {audit.map((event) => (
            <li key={event.id} className="border-b border-line py-3 text-sm">
              <span className="text-muted">{formatDay(event.at)} · </span>
              {event.summary}
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}

function EditRow({
  amountCents,
  destinationId,
  purpose,
  people,
  onSave,
}: {
  amountCents: number;
  destinationId: string;
  purpose: string;
  people: { id: string; name: string }[];
  onSave: (next: { amountCents: number; destinationPersonId: string; purpose: string }) => void;
}) {
  const [amount, setAmount] = useState((amountCents / 100).toFixed(2));
  const [destination, setDestination] = useState(destinationId);
  const [nextPurpose, setNextPurpose] = useState(purpose);
  const [localError, setLocalError] = useState("");
  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const cents = parseMoneyToCents(amount);
        if (!cents) {
          setLocalError("Enter an amount like 20.00.");
          return;
        }
        setLocalError("");
        onSave({ amountCents: cents, destinationPersonId: destination, purpose: nextPurpose });
      }}
    >
      <p className="text-sm text-muted">Changing the amount, destination, or purpose clears the yeses.</p>
      <input className={fieldClass} value={amount} onChange={(event) => setAmount(event.target.value)} aria-label="New amount" />
      <select className={fieldClass} value={destination} onChange={(event) => setDestination(event.target.value)} aria-label="New destination">
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
      <input className={fieldClass} value={nextPurpose} maxLength={120} onChange={(event) => setNextPurpose(event.target.value)} aria-label="New purpose" />
      {localError ? <Alert>{localError}</Alert> : null}
      <QuietButton type="submit">Save a new version</QuietButton>
    </form>
  );
}
