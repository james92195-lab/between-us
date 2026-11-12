import { z } from "zod";
import { err, ok, type Result } from "./result.ts";

export const CURRENCY = "USD" as const;
export type Currency = typeof CURRENCY;

export type Person = {
  id: string;
  name: string;
  isYou: boolean;
  note: string;
};

export type Loan = {
  id: string;
  lenderId: string;
  borrowerId: string;
  principalCents: number;
  currency: Currency;
  openedAt: number;
  dueOn: string | null;
  note: string;
  voidedAt: number | null;
};

export type Repayment = {
  id: string;
  loanId: string;
  amountCents: number;
  currency: Currency;
  at: number;
  note: string;
  /** Manual rows are written on this device. Provider rows are never accepted from the client. */
  source: "manual";
};

export type Jar = {
  id: string;
  name: string;
  goalCents: number;
  currency: Currency;
  createdAt: number;
  /** Not a legal conclusion. Nobody has chosen a custodian. */
  custody: "undecided";
  withdrawalRule: "three-other-active-members";
};

export type JarMember = {
  jarId: string;
  personId: string;
  status: "active" | "inactive";
  joinedAt: number;
};

export type Contribution = {
  id: string;
  jarId: string;
  personId: string;
  amountCents: number;
  currency: Currency;
  at: number;
  note: string;
  /** A promise written in the book. Not money received. */
  source: "recorded";
};

export type Approval = {
  personId: string;
  decision: "approve" | "reject";
  binding: string;
  at: number;
  /** This device recorded the vote. It is not a signed-in authorization. */
  authority: "device-record";
};

export type ExecutionAttempt = {
  idempotencyKey: string;
  at: number;
  fundsMoved: false;
  policyApproved: boolean;
  reasons: string[];
};

export type WithdrawalRequest = {
  id: string;
  jarId: string;
  requesterId: string;
  amountCents: number;
  currency: Currency;
  destinationPersonId: string;
  purpose: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  approvals: Approval[];
  closed: "rejected" | "cancelled" | null;
  executionAttempts: ExecutionAttempt[];
};

export type AuditEvent = {
  id: string;
  at: number;
  jarId: string | null;
  kind: string;
  summary: string;
};

export type Book = {
  people: Person[];
  loans: Loan[];
  repayments: Repayment[];
  jars: Jar[];
  members: JarMember[];
  contributions: Contribution[];
  withdrawals: WithdrawalRequest[];
  audit: AuditEvent[];
};

export function emptyBook(): Book {
  return {
    people: [{ id: "you", name: "You", isYou: true, note: "" }],
    loans: [],
    repayments: [],
    jars: [],
    members: [],
    contributions: [],
    withdrawals: [],
    audit: [],
  };
}

const personSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(40),
  isYou: z.boolean(),
  note: z.string().max(80),
});

const loanSchema = z.object({
  id: z.string().min(1),
  lenderId: z.string().min(1),
  borrowerId: z.string().min(1),
  principalCents: z.number().int().positive(),
  currency: z.literal("USD"),
  openedAt: z.number(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  note: z.string().max(120),
  voidedAt: z.number().nullable(),
});

const repaymentSchema = z.object({
  id: z.string().min(1),
  loanId: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.literal("USD"),
  at: z.number(),
  note: z.string().max(120),
  source: z.literal("manual"),
});

const jarSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  goalCents: z.number().int().positive(),
  currency: z.literal("USD"),
  createdAt: z.number(),
  custody: z.literal("undecided"),
  withdrawalRule: z.literal("three-other-active-members"),
});

const memberSchema = z.object({
  jarId: z.string().min(1),
  personId: z.string().min(1),
  status: z.enum(["active", "inactive"]),
  joinedAt: z.number(),
});

const contributionSchema = z.object({
  id: z.string().min(1),
  jarId: z.string().min(1),
  personId: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.literal("USD"),
  at: z.number(),
  note: z.string().max(120),
  source: z.literal("recorded"),
});

const approvalSchema = z.object({
  personId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  binding: z.string().min(1),
  at: z.number(),
  authority: z.literal("device-record"),
});

const attemptSchema = z.object({
  idempotencyKey: z.string().min(1).max(80),
  at: z.number(),
  fundsMoved: z.literal(false),
  policyApproved: z.boolean(),
  reasons: z.array(z.string()).max(12),
});

const withdrawalSchema = z.object({
  id: z.string().min(1),
  jarId: z.string().min(1),
  requesterId: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.literal("USD"),
  destinationPersonId: z.string().min(1),
  purpose: z.string().max(120),
  revision: z.number().int().positive(),
  createdAt: z.number(),
  updatedAt: z.number(),
  approvals: z.array(approvalSchema).max(40),
  closed: z.enum(["rejected", "cancelled"]).nullable(),
  executionAttempts: z.array(attemptSchema).max(40),
});

const auditSchema = z.object({
  id: z.string().min(1),
  at: z.number(),
  jarId: z.string().nullable(),
  kind: z.string().max(60),
  summary: z.string().max(240),
});

export const bookSchema = z.object({
  people: z.array(personSchema).min(1).max(24),
  loans: z.array(loanSchema).max(200),
  repayments: z.array(repaymentSchema).max(800),
  jars: z.array(jarSchema).max(24),
  members: z.array(memberSchema).max(200),
  contributions: z.array(contributionSchema).max(800),
  withdrawals: z.array(withdrawalSchema).max(200),
  audit: z.array(auditSchema).max(400),
});

export function parseBook(data: unknown): Result<Book> {
  const parsed = bookSchema.safeParse(data);
  if (!parsed.success) {
    return err(
      "invalid_book",
      "That file isn’t a Between Us book, or it claims a bank already confirmed money.",
    );
  }
  const you = parsed.data.people.filter((person) => person.isYou);
  if (you.length !== 1) return err("invalid_book", "A book needs exactly one person marked as you.");
  const ids = new Set(parsed.data.people.map((person) => person.id));
  if (ids.size !== parsed.data.people.length) {
    return err("invalid_book", "People in that file aren’t unique.");
  }
  return ok(parsed.data);
}

export function personName(book: Book, id: string): string {
  return book.people.find((person) => person.id === id)?.name ?? "Someone";
}

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 40);
}

export function pushAudit(book: Book, event: AuditEvent): Book {
  return { ...book, audit: [...book.audit, event].slice(-400) };
}
