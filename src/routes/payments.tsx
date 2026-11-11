import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { PrimaryButton } from "@/components/ui";
import { publicDwollaStatus, readDwollaEnv } from "@/lib/payments/dwolla";

export const Route = createFileRoute("/payments")({ component: PaymentsPage });

const localStatus = publicDwollaStatus(readDwollaEnv({}));

function PaymentsPage() {
  const [serverText, setServerText] = useState("");
  const [error, setError] = useState("");

  async function askServer() {
    setError("");
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/payments/status`);
      const body = (await response.json()) as { liveTransfers?: boolean; fundsMoved?: boolean; jarPooling?: boolean };
      setServerText(
        response.ok
          ? `Server agrees: live transfers ${String(body.liveTransfers)}, jar pooling ${String(body.jarPooling)}, funds moved ${String(body.fundsMoved)}.`
          : "The payment server refused the status check.",
      );
    } catch {
      setError("This host has no payment server. GitHub Pages only serves the static book.");
    }
  }

  return (
    <Shell>
      <p className="text-xs font-medium tracking-widest text-ember uppercase">Payments</p>
      <h1 className="mt-2 font-display text-4xl">Dwolla is not turned on</h1>
      <p className="mt-3 text-sm text-muted">
        US bank-to-bank transfers would use Dwolla, and only after Dwolla approves the peer-to-peer use case. Stripe and PayPal are not wired up. No card or bank form is on this page.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {localStatus.blockers.map((blocker) => (
          <li key={blocker} className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
            {blocker}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">
        A shared jar is not a Dwolla balance. Standard transfers move money through Dwolla’s own wallet, which is not an approved way to hold this circle’s pot. Deposits and withdrawals stay off.
      </p>
      <PrimaryButton type="button" className="mt-4" onClick={() => void askServer()}>
        Ask the server
      </PrimaryButton>
      {serverText ? <p className="mt-3 text-sm">{serverText}</p> : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-ember">
          {error}
        </p>
      ) : null}
    </Shell>
  );
}
