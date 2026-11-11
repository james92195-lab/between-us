import { httpsUrl, type Offer } from "./ledger.ts";
import { PAGES_URL } from "./site.ts";

const MAX_PRICE_CENTS = 100_000_00;

/** A link anyone can open. GitHub Pages has no database, so the offer rides in the query. */
export function offerSearch(offer: Offer): string {
  const params = new URLSearchParams();
  if (offer.priceCents > 0) params.set("price", String(offer.priceCents));
  params.set("every", offer.cadence === "once" ? "once" : "month");
  if (offer.paymentUrl) params.set("pay", offer.paymentUrl);
  if (offer.pitch.trim()) params.set("pitch", offer.pitch.trim().slice(0, 280));
  const query = params.toString();
  return query ? `${PAGES_URL}?${query}` : PAGES_URL;
}

/** Returns an offer only when the link names an https payment URL. */
export function offerFromSearch(search: string): Offer | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (!params.has("pay") && !params.has("price") && !params.has("pitch")) return null;
  const price = Number(params.get("price") ?? "0");
  const priceCents = Number.isInteger(price) && price >= 0 && price <= MAX_PRICE_CENTS ? price : 0;
  const paymentUrl = httpsUrl(params.get("pay") ?? "");
  const pitch = (params.get("pitch") ?? "").slice(0, 280);
  if (!paymentUrl) return null;
  return {
    priceCents,
    cadence: params.get("every") === "once" ? "once" : "month",
    paymentUrl,
    pitch,
  };
}
