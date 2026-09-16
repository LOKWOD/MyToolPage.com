import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

const vite = await createServer({ appType: "custom", configFile: false, server: { middlewareMode: true } });
test.after(async () => vite.close());
const calculators = await vite.ssrLoadModule("/lib/calculators.ts");

test("wage math applies a single overtime threshold", () => {
  assert.deepEqual(calculators.calculateWages([8, 9, 7], 20, 20, 1.5), {
    totalHours: 24, regularHours: 20, overtimeHours: 4, grossPay: 520,
  });
  assert.equal(calculators.calculateWages([], 0, 40, 1.5).grossPay, 0);
});

test("worker payout never produces a negative payment", () => {
  assert.deepEqual(calculators.calculateWorkerPay({ hours: 8, rate: 25, extra: 30, deduction: 20 }), { basePay: 200, amountDue: 210 });
  assert.equal(calculators.calculateWorkerPay({ hours: 1, rate: 10, extra: 0, deduction: 50 }).amountDue, 0);
});

test("tax proration handles leap years and closing-day conventions", () => {
  const beforeClosing = calculators.calculateTaxProration(3660, "2024-03-01", false);
  assert.equal(beforeClosing.daysInYear, 366);
  assert.equal(beforeClosing.sellerDays, 60);
  assert.equal(beforeClosing.buyerDays, 306);
  assert.equal(beforeClosing.dailyRate, 10);
  assert.equal(beforeClosing.sellerShare, 600);
  const throughClosing = calculators.calculateTaxProration(3660, "2024-03-01", true);
  assert.equal(throughClosing.sellerDays, 61);
  assert.equal(throughClosing.sellerShare, 610);
});
