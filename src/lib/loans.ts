import { personName, type Book, type Loan, type Repayment } from "./book.ts";
import { err, ok, type Result } from "./result.ts";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function loanRepayments(book: Book, loanId: string): Repayment[] {
  return book.repayments.filter((row) => row.loanId === loanId);
}

export function repaidCents(book: Book, loanId: string): number {
  return loanRepayments(book, loanId).reduce((sum, row) => sum + row.amountCents, 0);
}

export function remainingCents(loan: Loan, book: Book): number {
  if (loan.voidedAt !== null) return 0;
  return Math.max(0, loan.principalCents - repaidCents(book, loan.id));
}

export type LoanStanding = "open" | "overdue" | "repaid" | "voided";

export function loanStanding(loan: Loan, book: Book, today: string): LoanStanding {
  if (loan.voidedAt !== null) return "voided";
  if (remainingCents(loan, book) === 0) return "repaid";
  if (loan.dueOn && loan.dueOn < today) return "overdue";
  return "open";
}

export function positionCents(book: Book, personId: string): { owedToThem: number; theyOwe: number } {
  let owedToThem = 0;
  let theyOwe = 0;
  for (const loan of book.loans) {
    const left = remainingCents(loan, book);
    if (left === 0) continue;
    if (loan.lenderId === personId) owedToThem += left;
    if (loan.borrowerId === personId) theyOwe += left;
  }
  return { owedToThem, theyOwe };
}

export function createLoan(
  book: Book,
  input: {
    id: string;
    lenderId: string;
    borrowerId: string;
    principalCents: number;
    dueOn: string | null;
    note: string;
    openedAt: number;
  },
): Result<Book> {
  if (!book.people.some((person) => person.id === input.lenderId)) {
    return err("unknown_person", "Pick a lender who is in the circle.");
  }
  if (!book.people.some((person) => person.id === input.borrowerId)) {
    return err("unknown_person", "Pick a borrower who is in the circle.");
  }
  if (input.lenderId === input.borrowerId) {
    return err("same_person", "The lender and the borrower have to be two people.");
  }
  if (!Number.isSafeInteger(input.principalCents) || input.principalCents <= 0) {
    return err("amount", "Enter a loan amount like 25.50.");
  }
  if (input.dueOn !== null && !DAY.test(input.dueOn)) {
    return err("date", "Use a due date like 2026-12-01, or leave it blank.");
  }
  const loan: Loan = {
    id: input.id,
    lenderId: input.lenderId,
    borrowerId: input.borrowerId,
    principalCents: input.principalCents,
    currency: "USD",
    openedAt: input.openedAt,
    dueOn: input.dueOn,
    note: input.note.trim().slice(0, 120) || "Loan",
    voidedAt: null,
  };
  return ok({ ...book, loans: [...book.loans, loan] });
}

export function recordManualRepayment(
  book: Book,
  input: { id: string; loanId: string; amountCents: number; note: string; at: number },
): Result<Book> {
  const loan = book.loans.find((row) => row.id === input.loanId);
  if (!loan) return err("missing_loan", "That loan isn’t in the book.");
  if (loan.voidedAt !== null) return err("voided", "This loan was voided. Nothing more can be written against it.");
  const left = remainingCents(loan, book);
  if (left === 0) return err("repaid", "This loan is already written down as repaid.");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    return err("amount", "Enter a repayment like 10.00.");
  }
  if (input.amountCents > left) {
    return err("exceeds_remaining", "That repayment is larger than what’s still open.");
  }
  const repayment: Repayment = {
    id: input.id,
    loanId: loan.id,
    amountCents: input.amountCents,
    currency: "USD",
    at: input.at,
    note: input.note.trim().slice(0, 120) || "Written down",
    source: "manual",
  };
  return ok({ ...book, repayments: [...book.repayments, repayment] });
}

/** Provider-confirmed repayments are not created here. Dwolla has not approved this app. */
export function applyProviderRepayment(_book: Book): Result<Book> {
  return err(
    "payments_disabled",
    "A provider has not confirmed this repayment. Write it down by hand, or leave it open.",
  );
}

export function voidLoan(book: Book, loanId: string, at: number): Result<Book> {
  const loan = book.loans.find((row) => row.id === loanId);
  if (!loan) return err("missing_loan", "That loan isn’t in the book.");
  if (loan.voidedAt !== null) return ok(book);
  if (remainingCents(loan, book) === 0) {
    return err("repaid", "This loan is already repaid, so it stays in the history as repaid.");
  }
  return ok({
    ...book,
    loans: book.loans.map((row) => (row.id === loanId ? { ...row, voidedAt: at } : row)),
  });
}

export function addPerson(book: Book, input: { id: string; name: string; note: string }): Result<Book> {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!name) return err("name", "Add a name.");
  if (book.people.length >= 16) return err("full", "This circle is full.");
  return ok({
    ...book,
    people: [...book.people, { id: input.id, name, isYou: false, note: input.note.trim().slice(0, 80) }],
  });
}

export function renamePerson(book: Book, id: string, name: string): Result<Book> {
  const cleaned = name.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!cleaned) return err("name", "A name can’t be empty.");
  if (!book.people.some((person) => person.id === id)) return err("missing_person", "That person isn’t in the circle.");
  return ok({
    ...book,
    people: book.people.map((person) => (person.id === id ? { ...person, name: cleaned } : person)),
  });
}

export function personIsReferenced(book: Book, id: string): boolean {
  if (book.loans.some((loan) => loan.lenderId === id || loan.borrowerId === id)) return true;
  if (book.members.some((member) => member.personId === id)) return true;
  if (book.contributions.some((row) => row.personId === id)) return true;
  if (book.withdrawals.some((row) => row.requesterId === id || row.destinationPersonId === id)) return true;
  if (book.withdrawals.some((row) => row.approvals.some((approval) => approval.personId === id))) return true;
  return false;
}

export function removePerson(book: Book, id: string): Result<Book> {
  const person = book.people.find((row) => row.id === id);
  if (!person) return err("missing_person", "That person isn’t in the circle.");
  if (person.isYou) return err("keep_you", "You stay in the circle. This device still needs a name for the record keeper.");
  if (personIsReferenced(book, id)) {
    return err("referenced", "They’re already in a loan or a jar. The history keeps their name.");
  }
  return ok({ ...book, people: book.people.filter((row) => row.id !== id) });
}

export function loanTitle(book: Book, loan: Loan): string {
  return `${personName(book, loan.lenderId)} lent ${personName(book, loan.borrowerId)}`;
}
