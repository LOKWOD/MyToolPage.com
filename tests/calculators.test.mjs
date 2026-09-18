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

test("paired sales reports usable unit indications and a median", () => {
  const result = calculators.calculatePairedSales([
    { priceA: 400000, priceB: 370000, featureA: 2, featureB: 1, otherDifference: 5000 },
    { priceA: 510000, priceB: 470000, featureA: 3, featureB: 1, otherDifference: 0 },
    { priceA: 300000, priceB: 300000, featureA: 1, featureB: 1, otherDifference: 0 },
  ]);
  assert.equal(result.indications[0].unitAdjustment, 25000);
  assert.equal(result.indications[1].unitAdjustment, 20000);
  assert.equal(result.indications[2].unitAdjustment, null);
  assert.deepEqual({ validPairs: result.validPairs, low: result.low, median: result.median, high: result.high }, {
    validPairs: 2, low: 20000, median: 22500, high: 25000,
  });
});

test("break-even rate converts annual costs to hourly and assignment floors", () => {
  assert.deepEqual(calculators.calculateBreakEvenRate(100000, 50000, 50000, 10, 20, 50, 20, 5), {
    baseCost: 200000,
    reserve: 20000,
    annualRevenue: 275000,
    hourlyRate: 275,
    assignmentRate: 1100,
  });
  assert.deepEqual(calculators.calculateBreakEvenRate(0, 0, 0, 0, 0, 0, 0, 0), {
    baseCost: 0, reserve: 0, annualRevenue: 0, hourlyRate: 0, assignmentRate: 0,
  });
  assert.ok(Number.isFinite(calculators.calculateBreakEvenRate(1e308, 1e308, 1e308, 1e308, 1e308, 1e308, 1e308, 1e308).annualRevenue));
});

test("seller net sheet totals costs and solves the break-even sale price", () => {
  const result = calculators.calculateSellerNet(500000, 250000, 5, 5000, 3000, 10000, 7000, 0);
  assert.equal(result.commission, 25000);
  assert.equal(result.fixedCosts, 25000);
  assert.equal(result.sellingCosts, 50000);
  assert.equal(result.netProceeds, 200000);
  assert.ok(Math.abs(result.breakEvenPrice - 289473.6842105263) < .001);
  assert.equal(result.sellingCostPercent, 10);
  assert.equal(calculators.calculateSellerNet(100000, 150000, 0, 0, 0, 0, 0, 0).netProceeds, -50000);
});
