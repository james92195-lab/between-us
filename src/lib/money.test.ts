import assert from "node:assert/strict";
import test from "node:test";
import { centsToDwollaValue, formatMoney, parseMoneyToCents } from "./money.ts";

test("minor units avoid binary float", () => {
  const a = parseMoneyToCents("0.10");
  const b = parseMoneyToCents("0.20");
  assert.equal(a, 10);
  assert.equal(b, 20);
  assert.equal(a! + b!, 30);
  assert.equal(formatMoney(30), "$0.30");
  assert.notEqual(0.1 + 0.2, 0.3);
});

test("parses grouped dollars and rejects extra fractions", () => {
  assert.equal(parseMoneyToCents("$1,234.50"), 123450);
  assert.equal(parseMoneyToCents("10.5"), 1050);
  assert.equal(parseMoneyToCents("10.999"), null);
  assert.equal(parseMoneyToCents("1e2"), null);
  assert.equal(parseMoneyToCents("0"), null);
  assert.equal(parseMoneyToCents("-5"), null);
});

test("dwolla value is two decimal digits from cents", () => {
  assert.equal(centsToDwollaValue(1050), "10.50");
  assert.equal(centsToDwollaValue(5), "0.05");
});
