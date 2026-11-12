import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { httpsUrl, offerSearch, type HostingOffer } from "@/lib/offer-link";
import { formatMoney } from "@/lib/money";
import { PAGES_URL, REPO_URL } from "@/lib/site";

const STORAGE_KEY = "between-us-hosting-offer";

export const Route = createFileRoute("/sell")({ component: SellPage });

function readSaved(): HostingOffer {
  const empty: HostingOffer = { priceCents: 0, cadence: "month", paymentUrl: "", pitch: "" };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<HostingOffer>;
    return {
      priceCents: Number.isInteger(parsed.priceCents) && (parsed.priceCents ?? 0) >= 0 ? (parsed.priceCents as number) : 0,
      cadence: parsed.cadence === "once" ? "once" : "month",
      paymentUrl: httpsUrl(parsed.paymentUrl ?? ""),
      pitch: (parsed.pitch ?? "").slice(0, 280),
    };
  } catch {
    return empty;
  }
}

function SellPage() {
  const [price, setPrice] = useState("");
  const [cadence, setCadence] = useState<HostingOffer["cadence"]>("month");
  const [url, setUrl] = useState("");
  const [pitch, setPitch] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = readSaved();
    if (!saved.priceCents && !saved.paymentUrl && !saved.pitch) return;
    setPrice(saved.priceCents ? (saved.priceCents / 100).toFixed(2) : "");
    setCadence(saved.cadence);
    setUrl(saved.paymentUrl);
    setPitch(saved.pitch);
  }, []);

  const cleaned = price.trim().replace(/[$,]/g, "");
  const validPrice = cleaned === "" || /^\d+(\.\d{1,2})?$/.test(cleaned);
  const priceCents = validPrice && cleaned !== "" ? Math.round(Number(cleaned) * 100) : 0;
  const safeUrl = httpsUrl(url);
  const draft: HostingOffer = {
    priceCents: priceCents > 100_000_00 ? 0 : priceCents,
    cadence,
    paymentUrl: safeUrl,
    pitch: pitch.slice(0, 280),
  };
  const ready = draft.priceCents > 0 && Boolean(draft.paymentUrl);
  const publicLink = ready ? offerSearch(draft) : "";
  const pitchText = [
    "Between Us",
    `${formatMoney(draft.priceCents)} ${draft.cadence === "month" ? "a month" : "once"} to keep the circle hosted.`,
    draft.pitch,
    draft.paymentUrl ? `Pay: ${draft.paymentUrl}` : "",
    `Open the app: ${PAGES_URL}`,
  ]
    .filter(Boolean)
    .join("\n");

  function save(): boolean {
    if (url.trim() && !safeUrl) {
      setMessage("Payment links have to start with https:// — Stripe, Ko-fi, GitHub Sponsors, or Venmo.");
      return false;
    }
    if (!validPrice) {
      setMessage("Price should look like 8 or 8.00. Leave it blank to charge nothing.");
      return false;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setMessage("Offer saved on this device. It is a hosting link, not a loan payment.");
    return true;
  }

  async function copyText(value: string, ok: string) {
    if (!save()) return;
    try {
      await navigator.clipboard.writeText(value);
      setMessage(ok);
    } catch {
      setMessage("Couldn’t copy automatically. Select the text below.");
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
          <button
            type="button"
            onClick={() => void copyText(pitchText, "Offer copied. Send it however you already talk to them.")}
            className="h-11 rounded-full border border-ink px-4 text-sm"
          >
            Copy offer
          </button>
          {publicLink ? (
            <button
              type="button"
              onClick={() =>
                void copyText(publicLink, "Public link copied. Whoever opens it sees the Pay button on the live site.")
              }
              className="h-11 rounded-full bg-ember px-4 text-sm font-medium text-paper"
            >
              Copy public link
            </button>
          ) : null}
          <a
            href={`mailto:?subject=${encodeURIComponent("Between Us — hosting")}&body=${encodeURIComponent(
              publicLink ? `${pitchText}\n\nOpen and pay: ${publicLink}` : pitchText,
            )}`}
            className="inline-flex h-11 items-center rounded-full border border-line bg-card px-4 text-sm"
          >
            Email offer
          </a>
        </div>
        {publicLink ? (
          <p className="mt-3 text-sm break-all text-muted">
            Public link: <span className="text-ink">{publicLink}</span>
          </p>
        ) : null}
        {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
      </section>

      <section className="rounded-3xl border border-line bg-card p-4">
        <h2 className="font-display text-2xl">Run it from GitHub</h2>
        <p className="mt-2 text-sm text-muted">
          The public copy is at{" "}
          <a className="underline" href={PAGES_URL}>
            {PAGES_URL.replace("https://", "")}
          </a>
          . A push to <span className="text-ink">main</span> rebuilds it. The price rides in the link — Pages has no
          database. Whoever opens that link sees a Pay button for hosting, not a loan settlement. Source:{" "}
          <a className="underline" href={REPO_URL}>
            james92195-lab/between-us
          </a>
          .
        </p>
      </section>
    </Shell>
  );
}
