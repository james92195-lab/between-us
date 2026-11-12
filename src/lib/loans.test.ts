import assert from "node:assert/strict";
import test from "node:test";
import { emptyBook } from "./book.ts";
import { addPerson, createLoan, recordManualRepayment, remainingCents, voidLoan } from "./loans.ts";
import { applyProviderRepayment } from "./loans.ts";

function circle() {
  let book = emptyBook();
  const maya = addPerson(book, { id: "maya", name: "Maya", note: "" });
  assert.equal(maya.ok, true);
  if (!maya.ok) return book;
  book = maya.value;
  return book;
}

test("loan remaining uses integer cents and rejects overpayment", () => {
  let book = circle();
  const created = createLoan(book, {
    id: "loan-1",
    lenderId: "you",
    borrowerId: "maya",
    principalCents: 2550,
    dueOn: null,
    note: "Tickets",
    openedAt: 1,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  book = created.value;
  const loan = book.loans[0];
  assert.equal(remainingCents(loan, book), 2550);
  const part = recordManualRepayment(book, { id: "r1", loanId: "loan-1", amountCents: 1000, note: "Cash", at: 2 });
  assert.equal(part.ok, true);
  if (!part.ok) return;
  book = part.value;
  assert.equal(book.repayments[0].source, "manual");
  assert.equal(remainingCents(book.loans[0], book), 1550);
  const tooMuch = recordManualRepayment(book, { id: "r2", loanId: "loan-1", amountCents: 1551, note: "", at: 3 });
  assert.equal(tooMuch.ok, false);
  if (tooMuch.ok) return;
  assert.equal(tooMuch.code, "exceeds_remaining");
});

test("provider repayment is refused and does not change the book", () => {
  const book = emptyBook();
  const refused = applyProviderRepayment(book);
  assert.equal(refused.ok, false);
  if (refused.ok) return;
  assert.equal(refused.code, "payments_disabled");
});

test("voided loan cannot take another repayment", () => {
  let book = circle();
  const created = createLoan(book, {
    id: "loan-1",
    lenderId: "you",
    borrowerId: "maya",
    principalCents: 500,
    dueOn: "2026-12-01",
    note: "",
    openedAt: 1,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  book = created.value;
  const voided = voidLoan(book, "loan-1", 2);
  assert.equal(voided.ok, true);
  if (!voided.ok) return;
  const repaid = recordManualRepayment(voided.value, { id: "r", loanId: "loan-1", amountCents: 100, note: "", at: 3 });
  assert.equal(repaid.ok, false);
});
