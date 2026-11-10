import { formatMoney, type Offer } from "@/lib/ledger";
import { PAGES_URL } from "@/lib/site";

export function priceLine(offer: Offer): string {
  if (offer.priceCents <= 0) return "No charge yet";
  return `${formatMoney(offer.priceCents)} ${offer.cadence === "month" ? "a month" : "once"}`;
}

export function offerText(offer: Offer, books: string): string {
  return [
    "Between Us",
    offer.priceCents > 0
      ? `${priceLine(offer)} to keep our circle hosted.`
      : "A free circle. No charge.",
    offer.pitch,
    offer.paymentUrl ? `Pay: ${offer.paymentUrl}` : "",
    `Open the app: ${PAGES_URL}`,
    "",
    books,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Buyer-facing card. The books stay free; this is only the hosting ask. */
export function OfferCard({ offer }: { offer: Offer }) {
  const ready = offer.priceCents > 0 && Boolean(offer.paymentUrl);
  return (
    <section className="mb-5 rounded-3xl bg-ink p-5 text-paper">
      <p className="text-xs tracking-widest text-paper/70 uppercase">Hosting offer</p>
      <h2 className="mt-2 font-display text-4xl">{priceLine(offer)}</h2>
      <p className="mt-2 text-sm leading-relaxed text-paper/80">
        {offer.pitch || "Loans stay at zero interest. This pays for keeping the circle hosted."}
      </p>
      <p className="mt-3 text-sm text-paper/70">
        The app itself:{" "}
        <a className="underline" href={PAGES_URL}>
          {PAGES_URL.replace("https://", "")}
        </a>
      </p>
      {ready ? (
        <a
          href={offer.paymentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex h-12 items-center rounded-full bg-ember px-5 text-sm font-medium text-paper"
        >
          Pay {formatMoney(offer.priceCents)}
        </a>
      ) : (
        <p className="mt-4 text-sm text-paper/70">Add a price and an https payment link to turn this into something you can send.</p>
      )}
    </section>
  );
}
