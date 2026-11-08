import { z } from "zod";

export type Person = { id: string; name: string; isYou: boolean };

export type Share = { personId: string; shareCents: number; roundupCents: number };

export type Entry =
  | {
      id: string;
      kind: "expense";
      at: number;
      note: string;
      payerId: string;
      totalCents: number;
      shares: Share[];
    }
  | {
      id: string;
      kind: "settle";
      at: number;
      note: string;
      fromId: string;
      toId: string;
      amountCents: number;
    }
  | {
      id: string;
      kind: "drop";
      at: number;
      note: string;
      personId: string;
      amountCents: number;
    }
  | {
      id: string;
      kind: "donation";
      at: number;
      note: string;
      cause: string;
      amountCents: number;
    };

export type Offer = {
  priceCents: number;
  cadence: "once" | "month";
  paymentUrl: string;
  pitch: string;
};

export type Circle = {
  people: Person[];
  entries: Entry[];
  causeName: string;
  goalCents: number;
  offer: Offer;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMoney(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rest = (abs % 100).toString().padStart(2, "0");
  const grouped = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "−" : ""}$${grouped}.${rest}`;
}

export function formatSigned(cents: number): string {
  if (cents > 0) return `+${formatMoney(cents)}`;
  return formatMoney(cents);
}

export function formatDay(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function parseDollars(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [d, c = ""] = cleaned.split(".");
  const cents = Number(d) * 100 + Number((c + "00").slice(0, 2));
  if (!Number.isFinite(cents) || cents <= 0 || cents > 100_000_00) return null;
  return cents;
}

export function splitEven(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  const rem = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
}

export function roundUpToDollar(cents: number): number {
  const mod = ((cents % 100) + 100) % 100;
  return mod === 0 ? 0 : 100 - mod;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function buildExpense(input: {
  id: string;
  at: number;
  note: string;
  payerId: string;
  totalCents: number;
  memberIds: string[];
  roundUp: boolean;
}): Entry {
  const shares = splitEven(input.totalCents, input.memberIds.length);
  return {
    id: input.id,
    kind: "expense",
    at: input.at,
    note: input.note.trim() || "Shared bill",
    payerId: input.payerId,
    totalCents: input.totalCents,
    shares: input.memberIds.map((personId, i) => ({
      personId,
      shareCents: shares[i] ?? 0,
      roundupCents: input.roundUp ? roundUpToDollar(shares[i] ?? 0) : 0,
    })),
  };
}

export function balances(people: Person[], entries: Entry[]): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const person of people) bal[person.id] = 0;
  for (const entry of entries) {
    if (entry.kind === "expense") {
      for (const share of entry.shares) {
        if (share.personId === entry.payerId) continue;
        bal[entry.payerId] = (bal[entry.payerId] ?? 0) + share.shareCents;
        bal[share.personId] = (bal[share.personId] ?? 0) - share.shareCents;
      }
    } else if (entry.kind === "settle") {
      bal[entry.fromId] = (bal[entry.fromId] ?? 0) + entry.amountCents;
      bal[entry.toId] = (bal[entry.toId] ?? 0) - entry.amountCents;
    }
  }
  return bal;
}

export function jarCents(entries: Entry[]): number {
  return entries.reduce((sum, entry) => sum + jarDelta(entry), 0);
}

export function jarDelta(entry: Entry): number {
  if (entry.kind === "expense") return entry.shares.reduce((sum, share) => sum + share.roundupCents, 0);
  if (entry.kind === "drop") return entry.amountCents;
  if (entry.kind === "donation") return -entry.amountCents;
  return 0;
}

export type Transfer = { fromId: string; toId: string; amountCents: number };

export function settlePlan(bal: Record<string, number>): Transfer[] {
  const debtors = Object.entries(bal)
    .filter(([, value]) => value < -0)
    .map(([id, value]) => ({ id, left: -value }))
    .sort((a, b) => b.left - a.left);
  const creditors = Object.entries(bal)
    .filter(([, value]) => value > 0)
    .map(([id, value]) => ({ id, left: value }))
    .sort((a, b) => b.left - a.left);
  const plan: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    if (amount > 0) plan.push({ fromId: debtors[i].id, toId: creditors[j].id, amountCents: amount });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left === 0) i += 1;
    if (creditors[j].left === 0) j += 1;
  }
  return plan;
}

export function mentions(entry: Entry, id: string): boolean {
  if (entry.kind === "expense") {
    return entry.payerId === id || entry.shares.some((share) => share.personId === id);
  }
  if (entry.kind === "settle") return entry.fromId === id || entry.toId === id;
  if (entry.kind === "drop") return entry.personId === id;
  return false;
}

export function nameOf(people: Person[], id: string): string {
  return people.find((person) => person.id === id)?.name ?? "Someone";
}

export function entryTitle(entry: Entry, people: Person[]): string {
  const name = (id: string) => nameOf(people, id);
  if (entry.kind === "expense") return `${name(entry.payerId)} paid ${formatMoney(entry.totalCents)}`;
  if (entry.kind === "settle") return `${name(entry.fromId)} paid ${name(entry.toId)} ${formatMoney(entry.amountCents)}`;
  if (entry.kind === "drop") return `${name(entry.personId)} dropped ${formatMoney(entry.amountCents)}`;
  return `Gave ${formatMoney(entry.amountCents)} to ${entry.cause}`;
}

export function httpsUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

const shareSchema = z.object({
  personId: z.string().min(1),
  shareCents: z.number().int().nonnegative(),
  roundupCents: z.number().int().nonnegative(),
});

const entrySchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().min(1),
    kind: z.literal("expense"),
    at: z.number(),
    note: z.string().max(80),
    payerId: z.string().min(1),
    totalCents: z.number().int().positive(),
    shares: z.array(shareSchema).min(1),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("settle"),
    at: z.number(),
    note: z.string().max(80),
    fromId: z.string().min(1),
    toId: z.string().min(1),
    amountCents: z.number().int().positive(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("drop"),
    at: z.number(),
    note: z.string().max(80),
    personId: z.string().min(1),
    amountCents: z.number().int().positive(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("donation"),
    at: z.number(),
    note: z.string().max(80),
    cause: z.string().min(1).max(60),
    amountCents: z.number().int().positive(),
  }),
]);

const circleSchema = z.object({
  people: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        name: z.string().min(1).max(24),
        isYou: z.boolean(),
      }),
    )
    .min(1)
    .max(24),
  entries: z.array(entrySchema).max(400),
  causeName: z.string().min(1).max(60),
  goalCents: z.number().int().positive().max(1_000_000_00),
  offer: z.object({
    priceCents: z.number().int().nonnegative().max(100_000_00),
    cadence: z.enum(["once", "month"]),
    paymentUrl: z.string().max(300),
    pitch: z.string().max(280),
  }),
});

export function parseCircle(data: unknown): Circle | string {
  const parsed = circleSchema.safeParse(data);
  if (!parsed.success) return "That file isn’t a Between Us circle.";
  const you = parsed.data.people.filter((person) => person.isYou);
  if (you.length !== 1) return "A circle needs exactly one person marked as you.";
  const ids = new Set(parsed.data.people.map((person) => person.id));
  if (ids.size !== parsed.data.people.length) return "People in that file aren’t unique.";
  for (const entry of parsed.data.entries) {
    const involved =
      entry.kind === "expense"
        ? [entry.payerId, ...entry.shares.map((share) => share.personId)]
        : entry.kind === "settle"
          ? [entry.fromId, entry.toId]
          : entry.kind === "drop"
            ? [entry.personId]
            : [];
    if (involved.some((id) => !ids.has(id))) return "That file mentions someone who isn’t in the circle.";
  }
  return {
    ...parsed.data,
    offer: { ...parsed.data.offer, paymentUrl: httpsUrl(parsed.data.offer.paymentUrl) },
  };
}

function at(day: number): number {
  return Date.UTC(2026, 10, day, 16, 0, 0);
}

export function demoCircle(): Circle {
  const you = "you";
  const maya = "maya";
  const jonah = "jonah";
  const priya = "priya";
  const all = [you, maya, jonah, priya];
  return {
    people: [
      { id: you, name: "You", isYou: true },
      { id: maya, name: "Maya", isYou: false },
      { id: jonah, name: "Jonah", isYou: false },
      { id: priya, name: "Priya", isYou: false },
    ],
    entries: [
      buildExpense({
        id: "e-ramen",
        at: at(1),
        note: "Ramen night",
        payerId: jonah,
        totalCents: 8640,
        memberIds: all,
        roundUp: true,
      }),
      buildExpense({
        id: "e-groceries",
        at: at(3),
        note: "Thursday groceries",
        payerId: you,
        totalCents: 6418,
        memberIds: all,
        roundUp: true,
      }),
      {
        id: "s-bus",
        kind: "settle",
        at: at(4),
        note: "Bus fare",
        fromId: jonah,
        toId: you,
        amountCents: 1200,
      },
      buildExpense({
        id: "e-coffee",
        at: at(5),
        note: "Coffee run",
        payerId: maya,
        totalCents: 1850,
        memberIds: [you, maya, jonah],
        roundUp: true,
      }),
      { id: "d-you", kind: "drop", at: at(6), note: "Coat pocket", personId: you, amountCents: 500 },
      { id: "d-maya", kind: "drop", at: at(6), note: "Tip leftovers", personId: maya, amountCents: 300 },
      { id: "d-priya", kind: "drop", at: at(7), note: "Loose change", personId: priya, amountCents: 150 },
      {
        id: "g-fridge",
        kind: "donation",
        at: at(8),
        note: "First drop-off",
        cause: "Neighborhood fridge",
        amountCents: 800,
      },
    ],
    causeName: "Neighborhood fridge",
    goalCents: 4000,
    offer: { priceCents: 0, cadence: "month", paymentUrl: "", pitch: "" },
  };
}

export function blankCircle(): Circle {
  return {
    people: [{ id: "you", name: "You", isYou: true }],
    entries: [],
    causeName: "Something good",
    goalCents: 2500,
    offer: { priceCents: 0, cadence: "month", paymentUrl: "", pitch: "" },
  };
}

export function booksText(circle: Circle): string {
  const bal = balances(circle.people, circle.entries);
  const lines = [
    "Between Us",
    `${circle.causeName} — jar ${formatMoney(jarCents(circle.entries))} of ${formatMoney(circle.goalCents)}`,
    "",
    ...circle.people.map((person) => {
      const cents = bal[person.id] ?? 0;
      const standing = person.isYou
        ? cents > 0
          ? "You're owed"
          : cents < 0
            ? "You owe"
            : "You're square"
        : cents > 0
          ? "is owed"
          : cents < 0
            ? "owes"
            : "is square";
      const amount = cents === 0 ? "" : ` ${formatMoney(Math.abs(cents))}`;
      return `${person.name} ${standing}${amount}`;
    }),
  ];
  if (circle.offer.priceCents > 0) {
    const cadence = circle.offer.cadence === "month" ? "a month" : "once";
    lines.push("", `Hosting ${formatMoney(circle.offer.priceCents)} ${cadence}`);
    if (circle.offer.paymentUrl) lines.push(circle.offer.paymentUrl);
    if (circle.offer.pitch) lines.push(circle.offer.pitch);
  }
  return lines.join("\n");
}
