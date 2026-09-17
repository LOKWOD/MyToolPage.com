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

test("field day capacity includes only drives between stops", () => {
  assert.deepEqual(calculators.calculateFieldDayCapacity(510, 10, 30, 25, 30, 30), {
    stops: 10,
    totalMinutes: 585,
    maxStops: 8,
    remainingMinutes: -75,
  });
  assert.deepEqual(calculators.calculateFieldDayCapacity(0, 0, 0, 0, 0, 0), {
    stops: 0,
    totalMinutes: 0,
    maxStops: 0,
    remainingMinutes: 0,
  });
  assert.ok(Number.isFinite(calculators.calculateFieldDayCapacity(1e308, 1e308, 1e308, 1e308, 1e308, 1e308).totalMinutes));
});

test("repair estimate adds contingency and safely handles zero area", () => {
  assert.deepEqual(calculators.calculateRepairEstimate([
    { quantity: 2, unitCost: 100 },
    { quantity: 3, unitCost: 50 },
  ], 10, 770), {
    baseCost: 350,
    contingency: 35,
    totalCost: 385,
    costPerSquareFoot: .5,
  });
  assert.deepEqual(calculators.calculateRepairEstimate([
    { quantity: -2, unitCost: 100 },
  ], -10, 0), {
    baseCost: 0,
    contingency: 0,
    totalCost: 0,
    costPerSquareFoot: 0,
  });
  assert.ok(Number.isFinite(calculators.calculateRepairEstimate([
    { quantity: 1e308, unitCost: 1e308 },
  ], 1e308, 1).totalCost));
});
