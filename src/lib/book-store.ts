import { create } from "zustand";
import { persist } from "zustand/middleware";
import { emptyBook, parseBook, type Book } from "./book.ts";
import {
  addJarMember,
  approveWithdrawal,
  attemptWithdrawalExecution,
  cancelWithdrawal,
  createJar,
  createWithdrawal,
  editWithdrawal,
  recordContribution,
  rejectWithdrawal,
  setJarGoal,
  setMemberStatus,
} from "./jars.ts";
import { addPerson, createLoan, recordManualRepayment, removePerson, renamePerson, voidLoan } from "./loans.ts";
import type { Result } from "./result.ts";

type Actions = {
  storageWarning: string | null;
  addPerson: (name: string, note: string) => string | null;
  renamePerson: (id: string, name: string) => string | null;
  removePerson: (id: string) => string | null;
  createLoan: (input: {
    lenderId: string;
    borrowerId: string;
    principalCents: number;
    dueOn: string | null;
    note: string;
  }) => string | null;
  recordRepayment: (loanId: string, amountCents: number, note: string) => string | null;
  voidLoan: (loanId: string) => string | null;
  createJar: (name: string, goalCents: number) => string | null;
  setJarGoal: (jarId: string, goalCents: number) => string | null;
  addJarMember: (jarId: string, personId: string) => string | null;
  setMemberStatus: (jarId: string, personId: string, status: "active" | "inactive") => string | null;
  recordContribution: (jarId: string, personId: string, amountCents: number, note: string) => string | null;
  createWithdrawal: (input: {
    jarId: string;
    requesterId: string;
    amountCents: number;
    destinationPersonId: string;
    purpose: string;
  }) => string | null;
  editWithdrawal: (input: {
    withdrawalId: string;
    amountCents: number;
    destinationPersonId: string;
    purpose: string;
  }) => string | null;
  approveWithdrawal: (withdrawalId: string, personId: string) => string | null;
  rejectWithdrawal: (withdrawalId: string, personId: string) => string | null;
  cancelWithdrawal: (withdrawalId: string, personId: string) => string | null;
  checkWithdrawalSend: (withdrawalId: string) => string | null;
  replaceBook: (book: Book) => void;
  clearStorageWarning: () => void;
};

export type BookStore = Book & Actions;

function newId(): string {
  return crypto.randomUUID();
}

function apply(set: (partial: Partial<BookStore>) => void, result: Result<Book>): string | null {
  if (!result.ok) return result.error;
  set(result.value);
  return null;
}

export const useBook = create<BookStore>()(
  persist(
    (set, get) => ({
      ...emptyBook(),
      storageWarning: null,
      addPerson: (name, note) => apply(set, addPerson(get(), { id: newId(), name, note })),
      renamePerson: (id, name) => apply(set, renamePerson(get(), id, name)),
      removePerson: (id) => apply(set, removePerson(get(), id)),
      createLoan: (input) =>
        apply(
          set,
          createLoan(get(), {
            id: newId(),
            openedAt: Date.now(),
            ...input,
          }),
        ),
      recordRepayment: (loanId, amountCents, note) =>
        apply(set, recordManualRepayment(get(), { id: newId(), loanId, amountCents, note, at: Date.now() })),
      voidLoan: (loanId) => apply(set, voidLoan(get(), loanId, Date.now())),
      createJar: (name, goalCents) => {
        const keeper = get().people.find((person) => person.isYou);
        if (!keeper) return "The circle is missing you.";
        return apply(set, createJar(get(), { id: newId(), name, goalCents, at: Date.now(), keeperId: keeper.id }));
      },
      setJarGoal: (jarId, goalCents) =>
        apply(set, setJarGoal(get(), { jarId, goalCents, at: Date.now(), auditId: newId() })),
      addJarMember: (jarId, personId) =>
        apply(set, addJarMember(get(), { jarId, personId, at: Date.now(), auditId: newId() })),
      setMemberStatus: (jarId, personId, status) =>
        apply(set, setMemberStatus(get(), { jarId, personId, status, at: Date.now(), auditId: newId() })),
      recordContribution: (jarId, personId, amountCents, note) =>
        apply(set, recordContribution(get(), { id: newId(), jarId, personId, amountCents, note, at: Date.now() })),
      createWithdrawal: (input) => apply(set, createWithdrawal(get(), { id: newId(), at: Date.now(), ...input })),
      editWithdrawal: (input) =>
        apply(set, editWithdrawal(get(), { ...input, at: Date.now(), auditId: newId() })),
      approveWithdrawal: (withdrawalId, personId) =>
        apply(set, approveWithdrawal(get(), { withdrawalId, personId, at: Date.now(), auditId: newId() })),
      rejectWithdrawal: (withdrawalId, personId) =>
        apply(set, rejectWithdrawal(get(), { withdrawalId, personId, at: Date.now(), auditId: newId() })),
      cancelWithdrawal: (withdrawalId, personId) =>
        apply(set, cancelWithdrawal(get(), { withdrawalId, personId, at: Date.now(), auditId: newId() })),
      checkWithdrawalSend: (withdrawalId) => {
        const request = get().withdrawals.find((row) => row.id === withdrawalId);
        if (!request) return "That request isn’t in the book.";
        return apply(
          set,
          attemptWithdrawalExecution(get(), {
            withdrawalId,
            idempotencyKey: `check:${withdrawalId}:${request.revision}`,
            at: Date.now(),
            auditId: newId(),
          }),
        );
      },
      replaceBook: (book) => set(book),
      clearStorageWarning: () => set({ storageWarning: null }),
    }),
    {
      name: "between-us-book",
      version: 1,
      partialize: (state) => ({
        people: state.people,
        loans: state.loans,
        repayments: state.repayments,
        jars: state.jars,
        members: state.members,
        contributions: state.contributions,
        withdrawals: state.withdrawals,
        audit: state.audit,
      }),
      merge: (persisted, current) => {
        if (persisted == null || typeof persisted !== "object") {
          return { ...current, ...emptyBook(), storageWarning: null };
        }
        const parsed = parseBook(persisted);
        if (!parsed.ok) {
          try {
            const raw = localStorage.getItem("between-us-book");
            if (raw) localStorage.setItem("between-us-book-unreadable", raw);
          } catch {
            // Private mode can refuse storage. The fresh book still opens.
          }
          return {
            ...current,
            ...emptyBook(),
            storageWarning:
              "The saved book could not be read. A copy was left in this browser under a backup key, and a fresh book is open.",
          };
        }
        return { ...current, ...parsed.value, storageWarning: null };
      },
    },
  ),
);
