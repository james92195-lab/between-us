import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { OfferCard, offerText } from "@/components/offer-card";
import { Shell } from "@/components/shell";
import { booksText, httpsUrl, parseCircle, type Circle, type Offer } from "@/lib/ledger";
import { PAGES_SETTINGS_URL, PAGES_URL, REPO_URL } from "@/lib/site";
import { useLedger } from "@/lib/store";

export const Route = createFileRoute("/sell")({ component: SellPage });

function SellPage() {
  const offer = useLedger((s) => s.offer);
  const setOffer = useLedger((s) => s.setOffer);
  const replaceAll = useLedger((s) => s.replaceAll);
  const circle = useLedger(
    useShallow((s) => ({
      people: s.people,
      entries: s.entries,
      causeName: s.causeName,
      goalCents: s.goalCents,
      offer: s.offer,
    })),
  );
  const [price, setPrice] = useState(offer.priceCents ? (offer.priceCents / 100).toFixed(2) : "");
  const [cadence, setCadence] = useState<Offer["cadence"]>(offer.cadence);
  const [url, setUrl] = useState(offer.paymentUrl);
  const [pitch, setPitch] = useState(offer.pitch);
  const [message, setMessage] = useState("");

  const dollars = price.trim() === "" ? 0 : Number(price.replace(/[$,]/g, ""));
  const priceCents = Number.isFinite(dollars) && dollars >= 0 ? Math.round(dollars * 100) : offer.priceCents;
  const safeUrl = httpsUrl(url);
  const draft: Offer = {
    priceCents: priceCents > 100_000_00 ? offer.priceCents : priceCents,
    cadence,
    paymentUrl: safeUrl,
    pitch: pitch.slice(0, 280),
  };

  function save(): boolean {
    if (url.trim() && !safeUrl) {
      setMessage("Payment links have to start with https:// — Stripe, Ko-fi, GitHub Sponsors, or Venmo.");
      return false;
    }
    if (price.trim() && !/^\d+(\.\d{1,2})?$/.test(price.trim().replace(/[$,]/g, ""))) {
      setMessage("Price should look like 8 or 8.00. Leave it blank to charge nothing.");
      return false;
    }
    setOffer(draft);
    setMessage("Offer saved on this device.");
    return true;
  }

  const pitchText = offerText(draft, booksText({ ...circle, offer: draft }));

  async function copyOffer() {
    if (!save()) return;
    try {
      await navigator.clipboard.writeText(pitchText);
      setMessage("Offer copied. Send it however you already talk to them.");
    } catch {
      setMessage("Couldn’t copy automatically. Select the offer below.");
    }
  }

  return (
    <Shell>
      <header className="mb-5">
        <p className="text-xs font-medium tracking-widest text-ember uppercase">Sell</p>
        <h1 className="mt-2 font-display text-4xl">Host the circle</h1>
        <p className="mt-2 text-muted">
          Loans stay interest-free. Charge for keeping the circle — hosting, upkeep, your time. This app does not take
          cards. People pay on the link you paste, then open the public copy.
        </p>
      </header>

      <OfferCard offer={draft} />

      <section className="mb-5 rounded-3xl border border-line bg-card p-4">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Price</span>
          <input
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="0.00"
            className="h-12 w-full rounded-2xl border border-line bg-paper px-4 tabular-nums"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCadence("month")}
            className={`h-11 rounded-full text-sm ${cadence === "month" ? "bg-ink text-paper" : "border border-line"}`}
          >
            Each month
          </button>
          <button
            type="button"
            onClick={() => setCadence("once")}
            className={`h-11 rounded-full text-sm ${cadence === "once" ? "bg-ink text-paper" : "border border-line"}`}
          >
            One time
          </button>
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm text-muted">Payment link</span>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
            inputMode="url"
            className="h-12 w-full rounded-2xl border border-line bg-paper px-4"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm text-muted">What they’re paying for</span>
          <textarea
            value={pitch}
            onChange={(event) => setPitch(event.target.value)}
            maxLength={280}
            rows={3}
            placeholder="I keep the books and the jar for our house."
            className="w-full rounded-2xl border border-line bg-paper px-4 py-3"
          />
        </label>
        <button type="button" onClick={save} className="mt-3 h-11 rounded-full bg-ember px-5 text-sm font-medium text-paper">
          Save offer
        </button>
      </section>

      <section className="mb-5">
        <h2 className="font-display text-2xl">The offer</h2>
        <pre className="mt-2 overflow-x-auto rounded-2xl bg-ink p-4 text-sm leading-relaxed whitespace-pre-wrap text-paper">
          {pitchText}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void copyOffer()} className="h-11 rounded-full border border-ink px-4 text-sm">
            Copy offer
          </button>
          <a
            href={`mailto:?subject=${encodeURIComponent("Between Us — hosting")}&body=${encodeURIComponent(pitchText)}`}
            className="inline-flex h-11 items-center rounded-full border border-line bg-card px-4 text-sm"
          >
            Email offer
          </a>
          {draft.paymentUrl && (
            <a
              href={draft.paymentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center rounded-full bg-ink px-4 text-sm text-paper"
            >
              Open payment link
            </a>
          )}
        </div>
        {message && <p className="mt-3 text-sm text-muted">{message}</p>}
      </section>

      <section className="mb-5 rounded-3xl border border-line bg-card p-4">
        <h2 className="font-display text-2xl">Run it from GitHub</h2>
        <p className="mt-2 text-sm text-muted">
          The public copy is{" "}
          <a className="underline" href={PAGES_URL}>
            {PAGES_URL.replace("https://", "")}
          </a>
          . A push to <span className="text-ink">main</span> builds it. GitHub will not serve the site until you turn Pages
          on once: open{" "}
          <a className="underline" href={PAGES_SETTINGS_URL}>
            Pages settings
          </a>{" "}
          and set Source to <span className="text-ink">GitHub Actions</span>. The source is{" "}
          <a className="underline" href={REPO_URL}>
            james92195-lab/between-us
          </a>
          , licensed AGPL-3.0 — you can charge for hosting and support. If you serve a modified copy, people who use it
          can ask you for the source. AGPL is a poor fit if you want to sell a closed version.
        </p>
        <p className="mt-3 text-sm text-muted">
          Want your own domain? Import the same repo on Vercel. You do not need a database. Download the circle below if
          you want a backup. Payments stay on the link above.
        </p>
      </section>

      <Backup replaceAll={replaceAll} onMessage={setMessage} />
    </Shell>
  );
}

function Backup({
  replaceAll,
  onMessage,
}: {
  replaceAll: (circle: Circle) => void;
  onMessage: (message: string) => void;
}) {
  const snapshot = useLedger(
    useShallow((s) => ({
      people: s.people,
      entries: s.entries,
      causeName: s.causeName,
      goalCents: s.goalCents,
      offer: s.offer,
    })),
  );

  function download() {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "between-us.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCircle(JSON.parse(String(reader.result)));
        if (typeof parsed === "string") {
          onMessage(parsed);
          return;
        }
        replaceAll(parsed);
        onMessage("Circle imported on this device.");
      } catch {
        onMessage("That file isn’t a Between Us circle.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <section>
      <h2 className="font-display text-2xl">Take the books with you</h2>
      <p className="mt-1 mb-3 text-sm text-muted">Download the circle as a file, or bring one back. It never leaves this device otherwise.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={download} className="h-11 rounded-full border border-ink px-4 text-sm">
          Download circle
        </button>
        <label className="inline-flex h-11 cursor-pointer items-center rounded-full border border-line bg-card px-4 text-sm">
          Import circle
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </label>
      </div>
    </section>
  );
}
