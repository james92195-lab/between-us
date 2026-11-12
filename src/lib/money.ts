/** Integer minor units. One cent is 1. Never store dollar floats. */
export const MAX_CENTS = 100_000_000;

export function formatMoney(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100);
  const rest = (abs % 100).toString().padStart(2, "0");
  const grouped = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "−" : ""}$${grouped}.${rest}`;
}

/** Dwolla transfer amounts are decimal strings with two digits, derived from cents. */
export function centsToDwollaValue(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("Dwolla amount must be a positive integer number of cents.");
  }
  const dollars = Math.floor(cents / 100);
  const rest = (cents % 100).toString().padStart(2, "0");
  return `${dollars}.${rest}`;
}

/**
 * Accepts `18.50`, `$1,234.50`, `10.5`. Rejects extra fraction digits, exponents, and zero.
 */
export function parseMoneyToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [dollars, fraction = ""] = cleaned.split(".");
  const cents = Number(dollars) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) return null;
  return cents;
}

export function looksLikeBankNumber(raw: string): boolean {
  return /\d{8,}/.test(raw);
}

export function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
