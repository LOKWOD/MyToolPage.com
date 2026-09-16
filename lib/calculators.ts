export type WageTotals = {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  grossPay: number;
};

const safeNumber = (value: number) => Number.isFinite(value) ? value : 0;
const nonNegative = (value: number) => Math.max(0, safeNumber(value));

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
