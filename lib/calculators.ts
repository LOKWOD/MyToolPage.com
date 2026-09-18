export type WageTotals = {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  grossPay: number;
};

const safeNumber = (value: number) => Number.isFinite(value) ? value : 0;
const nonNegative = (value: number) => Math.max(0, safeNumber(value));
const boundedNonNegative = (value: number) => Math.min(Number.MAX_SAFE_INTEGER, nonNegative(value));
const boundedResult = (value: number) => Number.isFinite(value)
  ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, value))
  : Number.MAX_SAFE_INTEGER;

export function calculateWages(
  hours: number[],
  hourlyRate: number,
  overtimeAfter: number,
  overtimeMultiplier: number,
): WageTotals {
  const totalHours = hours.reduce((sum, value) => sum + nonNegative(value), 0);
  const threshold = nonNegative(overtimeAfter);
  const regularHours = Math.min(totalHours, threshold);
  const overtimeHours = Math.max(0, totalHours - threshold);
  const rate = nonNegative(hourlyRate);
  const multiplier = nonNegative(overtimeMultiplier);
  return {
    totalHours,
    regularHours,
    overtimeHours,
    grossPay: regularHours * rate + overtimeHours * rate * multiplier,
  };
}

export type WorkerPayInput = {
  hours: number;
  rate: number;
  extra: number;
  deduction: number;
};

export function calculateWorkerPay(worker: WorkerPayInput) {
  const basePay = nonNegative(worker.hours) * nonNegative(worker.rate);
  const extra = nonNegative(worker.extra);
  const deduction = nonNegative(worker.deduction);
  return { basePay, amountDue: Math.max(0, basePay + extra - deduction) };
}

export function calculateTaxProration(annualTaxes: number, closingDate: string, sellerPaysClosingDay: boolean) {
  const empty = { daysInYear: 0, sellerDays: 0, buyerDays: 0, dailyRate: 0, sellerShare: 0, buyerShare: 0 };
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(closingDate);
  if (!parsed) return empty;
  const year = Number(parsed[1]);
  const month = Number(parsed[2]);
  const day = Number(parsed[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return empty;
  const daysInYear = new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29 ? 366 : 365;
  const dayOfYear = Math.floor((date.getTime() - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
  const sellerDays = Math.min(daysInYear, Math.max(0, dayOfYear - (sellerPaysClosingDay ? 0 : 1)));
  const buyerDays = daysInYear - sellerDays;
  const taxes = nonNegative(annualTaxes);
  const dailyRate = taxes / daysInYear;
  return { daysInYear, sellerDays, buyerDays, dailyRate, sellerShare: dailyRate * sellerDays, buyerShare: dailyRate * buyerDays };
}

export function calculateFieldDayCapacity(
  workdayMinutes: number,
  requestedStops: number,
  inspectionMinutes: number,
  betweenStopMinutes: number,
  breakMinutes: number,
  bufferMinutes: number,
) {
  const day = boundedNonNegative(workdayMinutes);
  const stops = Math.floor(boundedNonNegative(requestedStops));
  const inspection = boundedNonNegative(inspectionMinutes);
  const travel = boundedNonNegative(betweenStopMinutes);
  const breaks = boundedNonNegative(breakMinutes);
  const buffer = boundedNonNegative(bufferMinutes);
  const totalMinutes = stops === 0
    ? 0
    : boundedResult(stops * inspection + Math.max(0, stops - 1) * travel + breaks + buffer);
  const usableMinutes = Math.max(0, day - breaks - buffer);
  const maxStops = inspection <= 0 || usableMinutes < inspection
    ? 0
    : 1 + Math.floor((usableMinutes - inspection) / (inspection + travel));
  return {
    stops,
    totalMinutes,
    maxStops: boundedResult(maxStops),
    remainingMinutes: day - totalMinutes,
  };
}

export type RepairCostInput = {
  quantity: number;
  unitCost: number;
};

export function calculateRepairEstimate(
  rows: RepairCostInput[],
  contingencyPercent: number,
  areaSquareFeet: number,
) {
  const baseCost = rows.reduce(
    (sum, row) => boundedResult(sum + boundedNonNegative(row.quantity) * boundedNonNegative(row.unitCost)),
    0,
  );
  const contingency = boundedResult(baseCost * boundedNonNegative(contingencyPercent) / 100);
  const totalCost = boundedResult(baseCost + contingency);
  const area = boundedNonNegative(areaSquareFeet);
  return {
    baseCost,
    contingency,
    totalCost,
    costPerSquareFoot: area > 0 ? totalCost / area : 0,
  };
}

export type PairedSaleInput = {
  priceA: number;
  priceB: number;
  featureA: number;
  featureB: number;
  otherDifference: number;
};

export function calculatePairedSales(rows: PairedSaleInput[]) {
  const indications = rows.map((row) => {
    const priceDifference = safeNumber(row.priceA) - safeNumber(row.priceB);
    const featureDifference = safeNumber(row.featureA) - safeNumber(row.featureB);
    const unexplainedDifference = priceDifference - safeNumber(row.otherDifference);
    const unitAdjustment = featureDifference === 0 ? null : unexplainedDifference / featureDifference;
    return {
      priceDifference,
      featureDifference,
      unexplainedDifference,
      unitAdjustment: unitAdjustment !== null && Number.isFinite(unitAdjustment) ? unitAdjustment : null,
    };
  });
  const valid = indications
    .map((row) => row.unitAdjustment)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const middle = Math.floor(valid.length / 2);
  const median = valid.length === 0 ? 0
    : valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
  return {
    indications,
    validPairs: valid.length,
    median,
    low: valid.length ? valid[0] : 0,
    high: valid.length ? valid[valid.length - 1] : 0,
  };
}

export function calculateBreakEvenRate(
  ownerPay: number,
  overhead: number,
  labor: number,
  reservePercent: number,
  profitMarginPercent: number,
  billableWeeks: number,
  billableHoursPerWeek: number,
  assignmentsPerWeek: number,
) {
  const baseCost = boundedResult(
    boundedNonNegative(ownerPay) + boundedNonNegative(overhead) + boundedNonNegative(labor),
  );
  const reserve = boundedResult(baseCost * boundedNonNegative(reservePercent) / 100);
  const preProfitRevenue = boundedResult(baseCost + reserve);
  const margin = Math.min(99.9, boundedNonNegative(profitMarginPercent)) / 100;
  const annualRevenue = preProfitRevenue === 0 ? 0 : boundedResult(preProfitRevenue / (1 - margin));
  const annualHours = boundedResult(boundedNonNegative(billableWeeks) * boundedNonNegative(billableHoursPerWeek));
  const annualAssignments = boundedResult(boundedNonNegative(billableWeeks) * boundedNonNegative(assignmentsPerWeek));
  return {
    baseCost,
    reserve,
    annualRevenue,
    hourlyRate: annualHours > 0 ? annualRevenue / annualHours : 0,
    assignmentRate: annualAssignments > 0 ? annualRevenue / annualAssignments : 0,
  };
}

export function calculateSellerNet(
  salePrice: number,
  mortgagePayoff: number,
  commissionPercent: number,
  transferTaxes: number,
  attorneyAndTitle: number,
  sellerCredits: number,
  repairs: number,
  otherCosts: number,
) {
  const price = boundedNonNegative(salePrice);
  const payoff = boundedNonNegative(mortgagePayoff);
  const commissionRate = Math.min(100, boundedNonNegative(commissionPercent)) / 100;
  const commission = boundedResult(price * commissionRate);
  const fixedCosts = boundedResult(
    boundedNonNegative(transferTaxes) + boundedNonNegative(attorneyAndTitle)
      + boundedNonNegative(sellerCredits) + boundedNonNegative(repairs) + boundedNonNegative(otherCosts),
  );
  const sellingCosts = boundedResult(commission + fixedCosts);
  const netProceeds = safeNumber(price - payoff - sellingCosts);
  const breakEvenPrice = commissionRate >= 1
    ? 0 : boundedResult((payoff + fixedCosts) / (1 - commissionRate));
  return {
    commission,
    fixedCosts,
    sellingCosts,
    netProceeds,
    breakEvenPrice,
    sellingCostPercent: price > 0 ? sellingCosts / price * 100 : 0,
  };
}
