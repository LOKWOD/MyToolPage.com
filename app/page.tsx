"use client";
/* eslint-disable react-hooks/set-state-in-effect -- localStorage is intentionally hydrated after the client mounts. */

import {
  AlarmClock, ArrowRight, BadgeDollarSign, Calculator, ChevronDown, ChevronUp,
  CircleDollarSign, Clock3, Copy, Grip, Hammer, Home, Maximize2,
  Pause, Play, Plus, RefreshCcw, Ruler, Search, SlidersHorizontal, Square, TableProperties,
  Trash2, TrendingUp, Wrench, MapPinned, CalendarClock, ReceiptText, Users, CalendarDays,
  Route, ClipboardList,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandShortcut,
} from "@/components/ui/command";
import {
  Fragment, PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState,
} from "react";
import {
  calculateFieldDayCapacity, calculateRepairEstimate, calculateTaxProration,
  calculateWages, calculateWorkerPay,
} from "@/lib/calculators";

type ToolId = "clock" | "wages" | "payroll" | "proration" | "fieldday" | "repairs" | "market" | "gla" | "convert" | "grid" | "fee" | "mileage" | "turnaround" | "quote";
type TimeRow = { day: string; start: string; end: string; breakMinutes: number };
type WorkerRow = { id: number; name: string; hours: number; rate: number; extra: number; deduction: number };
type RepairRow = { id: number; label: string; quantity: number; unitCost: number };
type AreaRow = { id: number; label: string; length: number; width: number; count: number };
type GridProperty = {
  gla: number; siteAcres: number; age: number; beds: number;
  fullBaths: number; halfBaths: number; garage: number; condition: string;
};
type GridComp = GridProperty & { id: number; label: string; salePrice: number };
type GridRates = {
  gla: number; siteAcres: number; age: number; beds: number;
  baths: number; garage: number; condition: number;
};
type AdjustmentKey = keyof GridRates;
type NumericGridKey = Exclude<keyof GridProperty, "condition">;

const TOOLS = [
  { id: "clock" as const, label: "Time Clock", short: "Clock", icon: Clock3, description: "Track a live work session and earnings" },
  { id: "wages" as const, label: "Wage Calculator", short: "Wages", icon: CircleDollarSign, description: "Total 1-day, 3-day, or weekly hours and gross pay" },
  { id: "payroll" as const, label: "Worker Payout Sheet", short: "Payouts", icon: Users, description: "Total a daily or multi-day payment batch" },
  { id: "proration" as const, label: "Tax Proration", short: "Proration", icon: CalendarDays, description: "Split annual property taxes at closing" },
  { id: "fieldday" as const, label: "Field Day Planner", short: "Field Day", icon: Route, description: "Test inspection-day capacity and build a stop schedule" },
  { id: "repairs" as const, label: "Repair Cost Worksheet", short: "Repairs", icon: ClipboardList, description: "Build a repair scope with contingency and cost per square foot" },
  { id: "market" as const, label: "Market Adjustment", short: "Market", icon: TrendingUp, description: "Calculate a supported time adjustment" },
  { id: "gla" as const, label: "GLA Worksheet", short: "GLA", icon: Ruler, description: "Build rectangular areas and total GLA" },
  { id: "convert" as const, label: "Property Converter", short: "Convert", icon: Calculator, description: "Convert land, distance, and price per square foot" },
  { id: "grid" as const, label: "Comp Adjustment Grid", short: "Comp Grid", icon: TableProperties, description: "Run side-by-side comparable adjustments" },
  { id: "fee" as const, label: "Assignment Fee IQ", short: "Fee IQ", icon: BadgeDollarSign, description: "Measure assignment profit and quote the right fee" },
  { id: "mileage" as const, label: "Trip Cost Calculator", short: "Trip Cost", icon: MapPinned, description: "Price fuel, vehicle wear, tolls, and travel time" },
  { id: "turnaround" as const, label: "Turnaround Planner", short: "Turnaround", icon: CalendarClock, description: "Calculate a delivery date in business days" },
  { id: "quote" as const, label: "Appraisal Fee Builder", short: "Fee Builder", icon: ReceiptText, description: "Build a defensible assignment quote" },
];

const DEFAULT_TIMES: TimeRow[] = [
  { day: "Mon", start: "", end: "", breakMinutes: 0 },
  { day: "Tue", start: "", end: "", breakMinutes: 0 },
  { day: "Wed", start: "", end: "", breakMinutes: 0 },
  { day: "Thu", start: "", end: "", breakMinutes: 0 },
  { day: "Fri", start: "", end: "", breakMinutes: 0 },
  { day: "Sat", start: "", end: "", breakMinutes: 0 },
  { day: "Sun", start: "", end: "", breakMinutes: 0 },
];

const DEFAULT_REPAIRS: RepairRow[] = [
  { id: 1, label: "", quantity: 0, unitCost: 0 },
  { id: 2, label: "", quantity: 0, unitCost: 0 },
  { id: 3, label: "", quantity: 0, unitCost: 0 },
];

const DEFAULT_AREAS: AreaRow[] = [
  { id: 1, label: "Main level", length: 40, width: 28, count: 1 },
  { id: 2, label: "Upper level", length: 32, width: 28, count: 1 },
];

const DEFAULT_SUBJECT: GridProperty = {
  gla: 2200, siteAcres: 1, age: 20, beds: 3,
  fullBaths: 2, halfBaths: 1, garage: 2, condition: "C3",
};

const DEFAULT_COMPS: GridComp[] = [
  { id: 1, label: "Comp 1", salePrice: 365000, gla: 2050, siteAcres: .8, age: 25, beds: 3, fullBaths: 2, halfBaths: 0, garage: 2, condition: "C3" },
  { id: 2, label: "Comp 2", salePrice: 389000, gla: 2325, siteAcres: 1.2, age: 16, beds: 4, fullBaths: 2, halfBaths: 1, garage: 2, condition: "C3" },
  { id: 3, label: "Comp 3", salePrice: 350000, gla: 1980, siteAcres: .65, age: 30, beds: 3, fullBaths: 1, halfBaths: 1, garage: 1, condition: "C4" },
];

const DEFAULT_RATES: GridRates = {
  gla: 75, siteAcres: 10000, age: 500, beds: 10000,
  baths: 15000, garage: 12000, condition: 25000,
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 2,
});

function safeNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function timeToMinutes(value: string) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
}

function hoursForRow(row: TimeRow) {
  const start = timeToMinutes(row.start);
  const end = timeToMinutes(row.end);
  if (start === null || end === null) return 0;
  const elapsed = end >= start ? end - start : 1440 - start + end;
  return Math.max(0, elapsed - (Number(row.breakMinutes) || 0)) / 60;
}

function formatElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((value) => String(value).padStart(2, "0")).join(":");
}

function formatClockMinutes(totalMinutes: number) {
  if (!Number.isFinite(totalMinutes)) return "—";
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  return hours ? `${hours} hr ${remainder} min` : `${remainder} min`;
}

function daysBetween(first: string, second: string) {
  if (!first || !second) return 0;
  const a = new Date(`${first}T12:00:00`);
  const b = new Date(`${second}T12:00:00`);
  return Number.isNaN(a.valueOf()) || Number.isNaN(b.valueOf())
    ? 0 : Math.round((b.valueOf() - a.valueOf()) / 86_400_000);
}

function conditionScore(condition: string) {
  const rating = Number(condition.replace(/\D/g, ""));
  return Number.isFinite(rating) && rating >= 1 && rating <= 6 ? 7 - rating : 0;
}

function signedMoney(value: number) {
  if (Math.abs(value) < .005) return "$0";
  return `${value > 0 ? "+" : "−"}${money.format(Math.abs(value))}`;
}

function getAdjustments(subject: GridProperty, comp: GridComp, rates: GridRates) {
  const adjustments: Record<AdjustmentKey, number> = {
    gla: (subject.gla - comp.gla) * rates.gla,
    siteAcres: (subject.siteAcres - comp.siteAcres) * rates.siteAcres,
    age: (comp.age - subject.age) * rates.age,
    beds: (subject.beds - comp.beds) * rates.beds,
    baths: ((subject.fullBaths + subject.halfBaths * .5) - (comp.fullBaths + comp.halfBaths * .5)) * rates.baths,
    garage: (subject.garage - comp.garage) * rates.garage,
    condition: (conditionScore(subject.condition) - conditionScore(comp.condition)) * rates.condition,
  };
  const total = Object.values(adjustments).reduce((sum, value) => sum + value, 0);
  const gross = Object.values(adjustments).reduce((sum, value) => sum + Math.abs(value), 0);
  return { adjustments, total, gross, adjustedPrice: comp.salePrice + total };
}

function NumberField({ label, value, onChange, prefix, suffix, step = "any", min }: {
  label: string; value: number | string; onChange: (value: number) => void;
  prefix?: string; suffix?: string; step?: string; min?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="number-input">
        {prefix && <b aria-hidden="true">{prefix}</b>}
        <input type="number" value={value} step={step} min={min}
          onChange={(event) => onChange(Number(event.target.value))} />
        {suffix && <b aria-hidden="true">{suffix}</b>}
      </span>
    </label>
  );
}

function ResultStat({ label, value, tone }: {
  label: string; value: string; tone?: "orange" | "blue";
}) {
  return <div className={`result-stat ${tone ? `result-${tone}` : ""}`}>
    <span>{label}</span><strong>{value}</strong>
  </div>;
}

function CalculationMethod({ children }: { children: ReactNode }) {
  return <details className="calculation-method">
    <summary>How this calculator works</summary>
    <div>{children}<small>Method reviewed September 17, 2026.</small></div>
  </details>;
}

function CommandCenter({ open, setOpen, onSelect }: {
  open: boolean; setOpen: (open: boolean) => void; onSelect: (tool: ToolId) => void;
}) {
  return <CommandDialog open={open} onOpenChange={setOpen}
    title="MyToolPage command center" description="Search for a tool and open it instantly."
    className="command-dialog">
    <CommandInput placeholder="Search every tool…" autoFocus />
    <CommandList>
      <CommandEmpty>No matching tool.</CommandEmpty>
      <CommandGroup heading="Open a tool">
        {TOOLS.map((tool, index) => {
          const Icon = tool.icon;
          return <CommandItem key={tool.id} value={`${tool.label} ${tool.description}`}
            onSelect={() => { onSelect(tool.id); setOpen(false); }}>
            <span className="command-item-icon"><Icon size={18} /></span>
            <span><strong>{tool.label}</strong><small>{tool.description}</small></span>
            <CommandShortcut>{String(index + 1).padStart(2, "0")}</CommandShortcut>
          </CommandItem>;
        })}
      </CommandGroup>
    </CommandList>
    <div className="command-hint"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>
  </CommandDialog>;
}

function FloatingToolStrip({ activeTool, onSelect }: {
  activeTool: ToolId; onSelect: (tool: ToolId) => void;
}) {
  const [position, setPosition] = useState({ x: 24, y: 84 });
  const [size, setSize] = useState({ width: 720, height: 92 });
  const [collapsed, setCollapsed] = useState(false);
  const [toolbarReady, setToolbarReady] = useState(false);
  const moveRef = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{
    pointerId: number; startX: number; startY: number; width: number; height: number;
  } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mtp-toolbar");
      if (saved) {
        const parsed = JSON.parse(saved) as { position?: typeof position; size?: typeof size };
        if (parsed.position) setPosition(parsed.position);
        if (parsed.size) setSize(parsed.size);
      } else {
        setPosition({ x: Math.max(16, (window.innerWidth - 720) / 2), y: 84 });
      }
    } catch { /* Storage is optional. */ }
    setToolbarReady(true);
  }, []);

  useEffect(() => {
    if (!toolbarReady) return;
    try { localStorage.setItem("mtp-toolbar", JSON.stringify({ position, size })); }
    catch { /* Storage is optional. */ }
  }, [position, size, toolbarReady]);

  const clamp = (x: number, y: number) => ({
    x: Math.max(8, Math.min(x, window.innerWidth - Math.min(size.width, window.innerWidth - 16))),
    y: Math.max(8, Math.min(y, window.innerHeight - Math.min(size.height, window.innerHeight - 16))),
  });

  const startMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    moveRef.current = { pointerId: event.pointerId, dx: event.clientX - position.x, dy: event.clientY - position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = moveRef.current;
    if (state?.pointerId === event.pointerId) setPosition(clamp(event.clientX - state.dx, event.clientY - state.dy));
  };
  const stopMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (moveRef.current?.pointerId === event.pointerId) moveRef.current = null;
  };
  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    resizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, ...size };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const resize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = resizeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    setSize({
      width: Math.max(330, Math.min(window.innerWidth - position.x - 8, state.width + event.clientX - state.startX)),
      height: Math.max(76, Math.min(210, state.height + event.clientY - state.startY)),
    });
  };
  const stopResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
  };

  return (
    <div className={`floating-strip ${collapsed ? "floating-strip-collapsed" : ""}`}
      style={{ left: position.x, top: position.y, width: collapsed ? 62 : size.width, height: collapsed ? 62 : size.height }}
      role="region" aria-label="Movable tool launcher">
      <button className="drag-handle" type="button" aria-label="Drag tool launcher"
        onPointerDown={startMove} onPointerMove={move} onPointerUp={stopMove} onPointerCancel={stopMove}>
        <Grip size={21} />
      </button>
      {!collapsed && <div className="tool-strip-actions">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return <button key={tool.id} type="button"
            className={activeTool === tool.id ? "tool-chip tool-chip-active" : "tool-chip"}
            onClick={() => onSelect(tool.id)} aria-pressed={activeTool === tool.id}>
            <Icon size={19} /><span>{tool.short}</span>
          </button>;
        })}
      </div>}
      <button className="collapse-handle" type="button" onClick={() => setCollapsed((value) => !value)}
        aria-label={collapsed ? "Expand tool launcher" : "Collapse tool launcher"}>
        {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </button>
      {!collapsed && <button className="resize-handle" type="button" aria-label="Resize tool launcher"
        onPointerDown={startResize} onPointerMove={resize} onPointerUp={stopResize} onPointerCancel={stopResize}>
        <Maximize2 size={14} />
      </button>}
    </div>
  );
}

function TimeClockTool({ rate, setRate }: { rate: number; setRate: (value: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [accumulated, setAccumulated] = useState(0);
  const [now, setNow] = useState(0);
  const [clockReady, setClockReady] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    try {
      const saved = localStorage.getItem("mtp-clock");
      if (saved) {
        const parsed = JSON.parse(saved) as { startedAt: number | null; accumulated: number };
        setStartedAt(parsed.startedAt); setAccumulated(parsed.accumulated || 0);
      }
    } catch { /* Ignore stale state. */ }
    setClockReady(true);
  }, []);
  useEffect(() => {
    if (!clockReady) return;
    try { localStorage.setItem("mtp-clock", JSON.stringify({ startedAt, accumulated })); }
    catch { /* Persistence is optional. */ }
    if (startedAt === null) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [startedAt, accumulated, clockReady]);

  const elapsed = accumulated + (startedAt === null ? 0 : Math.max(0, now - startedAt));
  const earned = elapsed / 3_600_000 * (Number(rate) || 0);
  const clockIn = () => { if (startedAt === null) { const time = Date.now(); setNow(time); setStartedAt(time); } };
  const pause = () => { if (startedAt !== null) { setAccumulated((value) => value + Date.now() - startedAt); setStartedAt(null); } };
  const reset = () => { setStartedAt(null); setAccumulated(0); setNow(Date.now()); };

  return <section className="tool-card tool-card-clock">
    <div className="tool-heading">
      <div className="tool-icon orange"><AlarmClock size={24} /></div>
      <div><p className="eyebrow">Live work session</p><h1>Time Clock</h1></div>
    </div>
    <div className="clock-face" aria-live="polite">
      <span>{startedAt === null ? (elapsed ? "Paused" : "Ready to work") : "Clocked in"}</span>
      <strong>{formatElapsed(elapsed)}</strong><p>{money.format(earned)} earned this session</p>
    </div>
    <div className="clock-controls">
      {startedAt === null
        ? <button className="primary-button" type="button" onClick={clockIn}><Play size={18} fill="currentColor" />{elapsed ? "Resume" : "Clock in"}</button>
        : <button className="primary-button" type="button" onClick={pause}><Pause size={18} fill="currentColor" />Pause</button>}
      <button className="secondary-button" type="button" onClick={reset}><RefreshCcw size={17} />Reset</button>
    </div>
    <div className="tool-footer-field">
      <NumberField label="Hourly rate" value={rate} onChange={setRate} prefix="$" min={0} step="0.25" />
      <p>Timer and rate are saved on this device.</p>
    </div>
  </section>;
}

function WageTool({ rate, setRate }: { rate: number; setRate: (value: number) => void }) {
  const [rows, setRows] = useState(DEFAULT_TIMES);
  const [periodDays, setPeriodDays] = useState<1 | 3 | 7>(3);
  const [overtimeAfter, setOvertimeAfter] = useState(40);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.5);
  const [copied, setCopied] = useState(false);
  const totals = useMemo(() => calculateWages(
    rows.slice(0, periodDays).map(hoursForRow), rate, overtimeAfter, overtimeMultiplier,
  ), [rows, periodDays, overtimeAfter, overtimeMultiplier, rate]);
  const updateRow = (index: number, key: keyof TimeRow, value: string | number) =>
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  const copySummary = async () => {
    const label = periodDays === 1 ? "Daily" : periodDays === 3 ? "3-day" : "Weekly";
    const text = `${label} time card: ${totals.totalHours.toFixed(2)} hours | ${totals.regularHours.toFixed(2)} regular | ${totals.overtimeHours.toFixed(2)} overtime | ${money.format(totals.grossPay)} gross pay`;
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };

  return <section className="tool-card wide-card">
    <div className="tool-heading heading-with-action">
      <div className="heading-group"><div className="tool-icon blue"><CircleDollarSign size={24} /></div>
        <div><p className="eyebrow">Daily, 3-day, or weekly pay</p><h1>Wage Calculator</h1></div></div>
      <div className="heading-actions"><button type="button" className="quiet-button" onClick={() => setRows(DEFAULT_TIMES)}><RefreshCcw size={16} />Clear</button>
        <button type="button" className="quiet-button" onClick={copySummary}><Copy size={16} />{copied ? "Copied" : "Copy summary"}</button></div>
    </div>
    <div className="period-control" role="group" aria-label="Pay period length">
      {([1, 3, 7] as const).map((days) => <button type="button" key={days} aria-pressed={periodDays === days}
        onClick={() => setPeriodDays(days)}>{days === 1 ? "1 day" : days === 3 ? "3 days" : "7 days"}</button>)}
    </div>
    <div className="wage-layout">
      <div className="time-table-wrap"><table className="time-table">
        <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Break</th><th>Hours</th></tr></thead>
        <tbody>{rows.slice(0, periodDays).map((row, index) => <tr key={row.day}>
          <th>{row.day}</th>
          <td><input aria-label={`${row.day} start time`} type="time" value={row.start} onChange={(event) => updateRow(index, "start", event.target.value)} /></td>
          <td><input aria-label={`${row.day} end time`} type="time" value={row.end} onChange={(event) => updateRow(index, "end", event.target.value)} /></td>
          <td><input aria-label={`${row.day} break minutes`} type="number" min="0" step="5" value={row.breakMinutes} onChange={(event) => updateRow(index, "breakMinutes", Number(event.target.value))} /></td>
          <td><strong>{hoursForRow(row).toFixed(2)}</strong></td>
        </tr>)}</tbody>
      </table></div>
      <aside className="settings-panel"><h2>Pay settings</h2>
        <NumberField label="Hourly rate" value={rate} onChange={setRate} prefix="$" min={0} step="0.25" />
        <NumberField label="Overtime after" value={overtimeAfter} onChange={setOvertimeAfter} suffix="hrs" min={0} step="0.5" />
        <NumberField label="OT multiplier" value={overtimeMultiplier} onChange={setOvertimeMultiplier} suffix="×" min={0} step="0.1" />
        <p className="settings-note">Gross estimate before taxes and deductions. The overtime threshold applies only to the rows shown; include prior workweek hours or change the threshold when required by applicable law.</p>
      </aside>
    </div>
    <div className="result-row four-results" aria-live="polite">
      <ResultStat label="Total hours" value={totals.totalHours.toFixed(2)} />
      <ResultStat label="Regular" value={totals.regularHours.toFixed(2)} />
      <ResultStat label="Overtime" value={totals.overtimeHours.toFixed(2)} tone="orange" />
      <ResultStat label="Estimated gross" value={money.format(totals.grossPay)} tone="blue" />
    </div>
    <CalculationMethod><p><strong>Gross pay</strong> = regular hours × hourly rate + overtime hours × hourly rate × overtime multiplier. The selected threshold is applied once to the displayed period. Overnight shifts roll past midnight, and break minutes are subtracted before pay is calculated.</p></CalculationMethod>
  </section>;
}

const DEFAULT_WORKERS: WorkerRow[] = [
  { id: 1, name: "", hours: 0, rate: 0, extra: 0, deduction: 0 },
  { id: 2, name: "", hours: 0, rate: 0, extra: 0, deduction: 0 },
  { id: 3, name: "", hours: 0, rate: 0, extra: 0, deduction: 0 },
];

function PayrollTool() {
  const [workers, setWorkers] = useState(DEFAULT_WORKERS);
  const [copied, setCopied] = useState(false);
  const results = workers.map(calculateWorkerPay);
  const totalHours = workers.reduce((sum, worker) => sum + Math.max(0, Number(worker.hours) || 0), 0);
  const totalDue = results.reduce((sum, result) => sum + result.amountDue, 0);
  const updateWorker = (id: number, key: keyof WorkerRow, value: string | number) =>
    setWorkers((current) => current.map((worker) => worker.id === id ? { ...worker, [key]: value } : worker));
  const addWorker = () => {
    const id = Math.max(0, ...workers.map((worker) => worker.id)) + 1;
    setWorkers((current) => [...current, { id, name: "", hours: 0, rate: 0, extra: 0, deduction: 0 }]);
  };
  const copyPayouts = async () => {
    const named = workers.map((worker, index) => `${worker.name.trim() || `Worker ${index + 1}`}: ${money.format(results[index].amountDue)}`);
    const text = `Worker payout sheet\n${named.join("\n")}\nTotal: ${money.format(totalDue)}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };

  return <section className="tool-card wide-card">
    <div className="tool-heading heading-with-action">
      <div className="heading-group"><div className="tool-icon orange"><Users size={24} /></div>
        <div><p className="eyebrow">Daily & multi-day payments</p><h1>Worker Payout Sheet</h1></div></div>
      <div className="heading-actions"><button type="button" className="quiet-button" onClick={() => setWorkers(DEFAULT_WORKERS)}><RefreshCcw size={16} />Clear</button>
        <button type="button" className="quiet-button" onClick={copyPayouts}><Copy size={16} />{copied ? "Copied" : "Copy payouts"}</button>
        <button type="button" className="secondary-button" onClick={addWorker}><Plus size={17} />Add worker</button></div>
    </div>
    <div className="payout-table-wrap"><table className="payout-table">
      <thead><tr><th>Worker</th><th>Hours</th><th>Rate</th><th>Extra / reimbursement</th><th>Deduction</th><th>Amount due</th><th><span className="sr-only">Remove</span></th></tr></thead>
      <tbody>{workers.map((worker, index) => <tr key={worker.id}>
        <td><input className="worker-name" aria-label={`Worker ${index + 1} name`} placeholder={`Worker ${index + 1}`} value={worker.name} onChange={(event) => updateWorker(worker.id, "name", event.target.value)} /></td>
        <td><input aria-label={`${worker.name || `Worker ${index + 1}`} hours`} type="number" min="0" step=".25" value={worker.hours} onChange={(event) => updateWorker(worker.id, "hours", Number(event.target.value))} /></td>
        <td><input aria-label={`${worker.name || `Worker ${index + 1}`} hourly rate`} type="number" min="0" step=".25" value={worker.rate} onChange={(event) => updateWorker(worker.id, "rate", Number(event.target.value))} /></td>
        <td><input aria-label={`${worker.name || `Worker ${index + 1}`} extra payment`} type="number" min="0" step=".01" value={worker.extra} onChange={(event) => updateWorker(worker.id, "extra", Number(event.target.value))} /></td>
        <td><input aria-label={`${worker.name || `Worker ${index + 1}`} deduction`} type="number" min="0" step=".01" value={worker.deduction} onChange={(event) => updateWorker(worker.id, "deduction", Number(event.target.value))} /></td>
        <td><strong>{money.format(results[index].amountDue)}</strong></td>
        <td>{workers.length > 1 && <button type="button" className="icon-button" aria-label={`Remove ${worker.name || `Worker ${index + 1}`}`} onClick={() => setWorkers((current) => current.filter((item) => item.id !== worker.id))}><Trash2 size={17} /></button>}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="result-row three-results" aria-live="polite"><ResultStat label="Workers" value={String(workers.length)} /><ResultStat label="Total hours" value={totalHours.toFixed(2)} /><ResultStat label="Total to pay" value={money.format(totalDue)} tone="blue" /></div>
    <CalculationMethod><p><strong>Amount due per worker</strong> = hours × rate + extra payments − deductions, with a floor of $0. Negative or nonnumeric amounts are treated as zero. Each row is calculated separately, then added to the batch total.</p></CalculationMethod>
    <p className="professional-note"><CircleDollarSign size={16} />Gross payout worksheet only. It does not calculate overtime, payroll taxes, withholding, benefits, or worker classification.</p>
  </section>;
}

function TaxProrationTool() {
  const today = new Date().toISOString().slice(0, 10);
  const [annualTaxes, setAnnualTaxes] = useState(0);
  const [closingDate, setClosingDate] = useState(today);
  const [sellerPaysClosingDay, setSellerPaysClosingDay] = useState(false);
  const result = calculateTaxProration(annualTaxes, closingDate, sellerPaysClosingDay);
  return <section className="tool-card wide-card">
    <div className="tool-heading"><div className="tool-icon blue"><CalendarDays size={24} /></div>
      <div><p className="eyebrow">Closing-day math</p><h1>Property Tax Proration</h1></div></div>
    <div className="market-grid proration-inputs">
      <NumberField label="Annual property taxes" value={annualTaxes} onChange={setAnnualTaxes} prefix="$" min={0} step="100" />
      <label className="field"><span>Closing date</span><input type="date" value={closingDate} onChange={(event) => setClosingDate(event.target.value)} /></label>
      <label className="field"><span>Who pays the closing day?</span><select value={sellerPaysClosingDay ? "seller" : "buyer"} onChange={(event) => setSellerPaysClosingDay(event.target.value === "seller")}><option value="buyer">Buyer</option><option value="seller">Seller</option></select></label>
    </div>
    <div className="result-row four-results" aria-live="polite">
      <ResultStat label="Daily tax rate" value={money.format(result.dailyRate)} />
      <ResultStat label={`Seller share · ${result.sellerDays} days`} value={money.format(result.sellerShare)} tone="orange" />
      <ResultStat label={`Buyer share · ${result.buyerDays} days`} value={money.format(result.buyerShare)} tone="blue" />
      <ResultStat label="Check total" value={money.format(result.sellerShare + result.buyerShare)} />
    </div>
    <CalculationMethod><p><strong>Daily rate</strong> = annual taxes ÷ 365, or ÷ 366 in a leap year. Seller share = daily rate × seller days; buyer share uses the remaining days. The closing-day choice moves one day between the parties without changing the annual total.</p></CalculationMethod>
    <p className="professional-note"><CalendarDays size={16} />Assumes calendar-year taxes accrue evenly across {result.daysInYear || 365} days. Confirm the tax period, local custom, contract language, exemptions, credits, and final settlement figures with the closing professional.</p>
  </section>;
}

function FieldDayTool() {
  const defaults = {
    startTime: "09:00", workdayHours: 8.5, stops: 10,
    inspectionMinutes: 30, travelMinutes: 25, breakMinutes: 30, bufferMinutes: 30,
  };
  const [values, setValues] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mtp-field-day");
      if (saved) setValues((current) => ({ ...current, ...JSON.parse(saved) }));
    } catch { /* Storage is optional. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem("mtp-field-day", JSON.stringify(values)); }
    catch { /* Storage is optional. */ }
  }, [values, ready]);

  const update = (key: keyof typeof values, value: number | string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const capacity = calculateFieldDayCapacity(
    values.workdayHours * 60, values.stops, values.inspectionMinutes,
    values.travelMinutes, values.breakMinutes, values.bufferMinutes,
  );
  const start = timeToMinutes(values.startTime) ?? 0;
  const plannedFinish = start + capacity.totalMinutes;
  const schedule = useMemo(() => {
    const rows: { stop: number; arrival: number; departure: number }[] = [];
    const count = Math.min(50, Math.floor(safeNonNegative(Number(values.stops))));
    let cursor = start;
    const breakAfter = Math.ceil(count / 2);
    const inspection = safeNonNegative(Number(values.inspectionMinutes));
    const travel = safeNonNegative(Number(values.travelMinutes));
    const breakTime = safeNonNegative(Number(values.breakMinutes));
    for (let index = 0; index < count; index++) {
      const departure = cursor + inspection;
      rows.push({ stop: index + 1, arrival: cursor, departure });
      cursor = departure;
      if (index + 1 === breakAfter) cursor += breakTime;
      if (index < count - 1) cursor += travel;
    }
    return rows;
  }, [start, values.stops, values.inspectionMinutes, values.travelMinutes, values.breakMinutes]);
  const copyPlan = async () => {
    const status = capacity.remainingMinutes >= 0
      ? `${formatDuration(capacity.remainingMinutes)} available`
      : `${formatDuration(Math.abs(capacity.remainingMinutes))} over capacity`;
    const text = `Field day plan: ${capacity.stops} stops | Start ${formatClockMinutes(start)} | Finish ${formatClockMinutes(plannedFinish)} | ${formatDuration(capacity.totalMinutes)} total | ${status} | Maximum ${capacity.maxStops} stops with these assumptions`;
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };

  return <section className="tool-card wide-card">
    <div className="tool-heading heading-with-action">
      <div className="heading-group"><div className="tool-icon orange"><Route size={24} /></div>
        <div><p className="eyebrow">Inspection-day capacity</p><h1>Field Day Planner</h1></div></div>
      <div className="heading-actions">
        <button type="button" className="quiet-button" onClick={() => setValues(defaults)}><RefreshCcw size={16} />Reset</button>
        <button type="button" className="quiet-button" onClick={copyPlan}><Copy size={16} />{copied ? "Copied" : "Copy plan"}</button>
      </div>
    </div>
    <div className="planner-layout">
      <div className="planner-inputs">
        <label className="field"><span>First arrival</span><input type="time" value={values.startTime} onChange={(event) => update("startTime", event.target.value)} /></label>
        <NumberField label="Workday limit" value={values.workdayHours} onChange={(value) => update("workdayHours", value)} suffix="hrs" min={0} step=".25" />
        <NumberField label="Planned stops" value={values.stops} onChange={(value) => update("stops", value)} suffix="stops" min={0} step="1" />
        <NumberField label="Minutes per inspection" value={values.inspectionMinutes} onChange={(value) => update("inspectionMinutes", value)} suffix="min" min={0} step="5" />
        <NumberField label="Average drive between stops" value={values.travelMinutes} onChange={(value) => update("travelMinutes", value)} suffix="min" min={0} step="5" />
        <NumberField label="Meal / break time" value={values.breakMinutes} onChange={(value) => update("breakMinutes", value)} suffix="min" min={0} step="5" />
        <NumberField label="End-of-day buffer" value={values.bufferMinutes} onChange={(value) => update("bufferMinutes", value)} suffix="min" min={0} step="5" />
      </div>
      <aside className={`capacity-panel ${capacity.remainingMinutes < 0 ? "capacity-over" : "capacity-fit"}`} aria-live="polite">
        <span className="decision-kicker">Capacity check</span>
        <strong>{capacity.remainingMinutes < 0 ? "Over capacity" : "Fits the day"}</strong>
        <p>{capacity.remainingMinutes < 0
          ? `${formatDuration(Math.abs(capacity.remainingMinutes))} beyond the workday limit.`
          : `${formatDuration(capacity.remainingMinutes)} remains inside the workday limit.`}</p>
        <div><span>Planned finish</span><b>{formatClockMinutes(plannedFinish)}</b></div>
        <div><span>Maximum stops</span><b>{capacity.maxStops}</b></div>
      </aside>
    </div>
    <div className="schedule-table-wrap"><table className="schedule-table">
      <thead><tr><th>Stop</th><th>Arrival</th><th>Inspection ends</th><th>Drive to next</th></tr></thead>
      <tbody>{schedule.length ? schedule.map((row, index) => <tr key={row.stop}>
        <th>Stop {row.stop}</th><td>{formatClockMinutes(row.arrival)}</td><td>{formatClockMinutes(row.departure)}</td>
        <td>{index === schedule.length - 1 ? "—" : formatDuration(safeNonNegative(Number(values.travelMinutes)))}</td>
      </tr>) : <tr><td colSpan={4}>Add at least one stop to build the schedule.</td></tr>}</tbody>
    </table></div>
    {capacity.stops > 50 && <p className="settings-note">Capacity math includes all {capacity.stops} stops; the schedule preview shows the first 50.</p>}
    <CalculationMethod><p><strong>Total route time</strong> = stops × inspection minutes + drives between stops + break + end-of-day buffer. Maximum stops uses the same assumptions inside the workday limit. The break is placed after the middle stop in the preview; the buffer is included in the finish time.</p></CalculationMethod>
    <p className="professional-note"><Route size={16} />Planning aid only. It does not optimize addresses, predict traffic, reserve appointment windows, or include report-writing time unless you add it to the buffer.</p>
  </section>;
}

function RepairCostTool() {
  const [rows, setRows] = useState(DEFAULT_REPAIRS);
  const [contingencyPercent, setContingencyPercent] = useState(10);
  const [area, setArea] = useState(0);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mtp-repair-scope");
      if (saved) {
        const parsed = JSON.parse(saved) as { rows?: RepairRow[]; contingencyPercent?: number; area?: number };
        if (Array.isArray(parsed.rows) && parsed.rows.length) setRows(parsed.rows);
        if (Number.isFinite(parsed.contingencyPercent)) setContingencyPercent(parsed.contingencyPercent ?? 10);
        if (Number.isFinite(parsed.area)) setArea(parsed.area ?? 0);
      }
    } catch { /* Storage is optional. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem("mtp-repair-scope", JSON.stringify({ rows, contingencyPercent, area })); }
    catch { /* Storage is optional. */ }
  }, [rows, contingencyPercent, area, ready]);
  const result = calculateRepairEstimate(rows, contingencyPercent, area);
  const updateRow = (id: number, key: keyof RepairRow, value: string | number) =>
    setRows((current) => current.map((row) => row.id === id ? { ...row, [key]: value } : row));
  const addRow = () => setRows((current) => [
    ...current, { id: Math.max(0, ...current.map((row) => row.id)) + 1, label: "", quantity: 0, unitCost: 0 },
  ]);
  const copyScope = async () => {
    const lineItems = rows
      .filter((row) => row.label.trim() || row.quantity || row.unitCost)
      .map((row, index) => `${row.label.trim() || `Item ${index + 1}`}: ${safeNonNegative(Number(row.quantity))} × ${money.format(safeNonNegative(Number(row.unitCost)))} = ${money.format(Math.min(Number.MAX_SAFE_INTEGER, safeNonNegative(Number(row.quantity)) * safeNonNegative(Number(row.unitCost))))}`);
    const text = `Repair cost worksheet\n${lineItems.length ? `${lineItems.join("\n")}\n` : ""}Base: ${money.format(result.baseCost)}\nContingency (${safeNonNegative(Number(contingencyPercent))}%): ${money.format(result.contingency)}\nBudget total: ${money.format(result.totalCost)}${area > 0 ? `\nCost per square foot: ${money.format(result.costPerSquareFoot)}` : ""}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };

  return <section className="tool-card wide-card">
    <div className="tool-heading heading-with-action">
      <div className="heading-group"><div className="tool-icon blue"><ClipboardList size={24} /></div>
        <div><p className="eyebrow">Scope and contingency</p><h1>Repair Cost Worksheet</h1></div></div>
      <div className="heading-actions">
        <button type="button" className="quiet-button" onClick={() => { setRows(DEFAULT_REPAIRS); setContingencyPercent(10); setArea(0); }}><RefreshCcw size={16} />Clear</button>
        <button type="button" className="quiet-button" onClick={copyScope}><Copy size={16} />{copied ? "Copied" : "Copy scope"}</button>
        <button type="button" className="secondary-button" onClick={addRow}><Plus size={17} />Add item</button>
      </div>
    </div>
    <div className="repair-table-wrap"><table className="repair-table">
      <thead><tr><th>Repair or scope item</th><th>Quantity</th><th>Cost per unit</th><th>Line total</th><th><span className="sr-only">Remove</span></th></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row.id}>
        <td><input aria-label={`Repair item ${index + 1}`} placeholder="Describe the work" value={row.label} onChange={(event) => updateRow(row.id, "label", event.target.value)} /></td>
        <td><input aria-label={`${row.label || `Repair item ${index + 1}`} quantity`} type="number" min="0" step="any" value={row.quantity} onChange={(event) => updateRow(row.id, "quantity", Number(event.target.value))} /></td>
        <td><input aria-label={`${row.label || `Repair item ${index + 1}`} cost per unit`} type="number" min="0" step=".01" value={row.unitCost} onChange={(event) => updateRow(row.id, "unitCost", Number(event.target.value))} /></td>
        <td><strong>{money.format(Math.min(Number.MAX_SAFE_INTEGER, safeNonNegative(Number(row.quantity)) * safeNonNegative(Number(row.unitCost))))}</strong></td>
        <td>{rows.length > 1 && <button type="button" className="icon-button" aria-label={`Remove ${row.label || `repair item ${index + 1}`}`} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}><Trash2 size={17} /></button>}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="repair-settings">
      <NumberField label="Contingency" value={contingencyPercent} onChange={setContingencyPercent} suffix="%" min={0} step="1" />
      <NumberField label="Optional project area" value={area} onChange={setArea} suffix="sf" min={0} step="1" />
      <p>Use quantity as rooms, items, square feet, or another consistent unit. Enter zero area to omit the per-square-foot result.</p>
    </div>
    <div className="result-row four-results" aria-live="polite">
      <ResultStat label="Base repair cost" value={money.format(result.baseCost)} />
      <ResultStat label="Contingency" value={money.format(result.contingency)} tone="orange" />
      <ResultStat label="Budget total" value={money.format(result.totalCost)} tone="blue" />
      <ResultStat label="Cost per square foot" value={area > 0 ? money.format(result.costPerSquareFoot) : "Add area"} />
    </div>
    <CalculationMethod><p><strong>Base cost</strong> = the sum of quantity × unit cost for every row. Contingency = base cost × contingency percentage. Cost per square foot divides the total, including contingency, by the optional project area. Negative or nonnumeric entries are treated as zero.</p></CalculationMethod>
    <p className="professional-note"><ClipboardList size={16} />Early budgeting aid only—not a contractor bid, appraisal adjustment, inspection finding, code review, or permit opinion. Verify scope, quantities, labor, materials, taxes, and local requirements with qualified professionals.</p>
  </section>;
}

function MarketTool() {
  const [salePrice, setSalePrice] = useState(350000);
  const [saleDate, setSaleDate] = useState("2025-08-26");
  const [effectiveDate, setEffectiveDate] = useState("2026-08-26");
  const [annualRate, setAnnualRate] = useState(4);
  const days = daysBetween(saleDate, effectiveDate);
  const months = days / 30.4375;
  const adjustmentPercent = annualRate / 12 * months;
  const adjustmentDollars = salePrice * adjustmentPercent / 100;
  return <section className="tool-card wide-card">
    <div className="tool-heading"><div className="tool-icon orange"><TrendingUp size={24} /></div>
      <div><p className="eyebrow">Appraisal toolbox</p><h1>Market-Condition Adjustment</h1></div></div>
    <div className="market-grid">
      <NumberField label="Comparable sale price" value={salePrice} onChange={setSalePrice} prefix="$" min={0} step="1000" />
      <label className="field"><span>Sale date</span><input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} /></label>
      <label className="field"><span>Effective date</span><input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} /></label>
      <NumberField label="Supported annual change" value={annualRate} onChange={setAnnualRate} suffix="%" step="0.1" />
    </div>
    <div className="formula-strip"><span>{Math.abs(days)} days</span><ArrowRight size={18} /><span>{Math.abs(months).toFixed(2)} months</span><ArrowRight size={18} /><span>{adjustmentPercent >= 0 ? "+" : ""}{adjustmentPercent.toFixed(2)}%</span></div>
    <div className="result-row market-results" aria-live="polite">
      <ResultStat label="Time adjustment" value={`${adjustmentDollars >= 0 ? "+" : "−"}${money.format(Math.abs(adjustmentDollars))}`} tone="orange" />
      <ResultStat label="Adjusted indication" value={money.format(salePrice + adjustmentDollars)} tone="blue" />
    </div>
    <p className="professional-note"><Hammer size={16} />Analytical aid only. The appraiser remains responsible for support, methodology, direction, and reconciliation.</p>
  </section>;
}

function GlaTool() {
  const [areas, setAreas] = useState(DEFAULT_AREAS);
  const total = areas.reduce((sum, area) => sum + area.length * area.width * area.count, 0);
  const updateArea = (id: number, key: keyof AreaRow, value: string | number) =>
    setAreas((current) => current.map((area) => area.id === id ? { ...area, [key]: value } : area));
  const addArea = () => {
    const id = Math.max(0, ...areas.map((area) => area.id)) + 1;
    setAreas((current) => [...current, { id, label: `Area ${id}`, length: 0, width: 0, count: 1 }]);
  };
  return <section className="tool-card wide-card">
    <div className="tool-heading heading-with-action">
      <div className="heading-group"><div className="tool-icon blue"><Ruler size={24} /></div><div><p className="eyebrow">Appraisal toolbox</p><h1>GLA Worksheet</h1></div></div>
      <button type="button" className="secondary-button" onClick={addArea}><Plus size={17} />Add area</button>
    </div>
    <div className="area-list">
      <div className="area-labels" aria-hidden="true"><span>Description</span><span>Length</span><span>Width</span><span>Count</span><span>Area</span><span /></div>
      {areas.map((area) => <div className="area-row" key={area.id}>
        <input aria-label="Area description" value={area.label} onChange={(event) => updateArea(area.id, "label", event.target.value)} />
        <input aria-label={`${area.label} length`} type="number" min="0" step="0.1" value={area.length} onChange={(event) => updateArea(area.id, "length", Number(event.target.value))} />
        <input aria-label={`${area.label} width`} type="number" min="0" step="0.1" value={area.width} onChange={(event) => updateArea(area.id, "width", Number(event.target.value))} />
        <input aria-label={`${area.label} count`} type="number" min="0" step="1" value={area.count} onChange={(event) => updateArea(area.id, "count", Number(event.target.value))} />
        <strong>{(area.length * area.width * area.count).toLocaleString(undefined, { maximumFractionDigits: 1 })} sf</strong>
        <button type="button" className="icon-button" aria-label={`Remove ${area.label}`} onClick={() => setAreas((current) => current.filter((item) => item.id !== area.id))}><Trash2 size={17} /></button>
      </div>)}
    </div>
    <div className="gla-total"><span>Calculated gross living area</span><strong>{total.toLocaleString(undefined, { maximumFractionDigits: 1 })} <small>sq ft</small></strong></div>
    <p className="professional-note"><Square size={15} />Rectangular-area worksheet. Apply the applicable measurement standard and professional judgment.</p>
  </section>;
}

function ConvertTool() {
  const [squareFeet, setSquareFeet] = useState(43560);
  const [miles, setMiles] = useState(1);
  const [price, setPrice] = useState(475000);
  const [gla, setGla] = useState(2200);
  return <section className="tool-card wide-card">
    <div className="tool-heading"><div className="tool-icon orange"><Calculator size={24} /></div><div><p className="eyebrow">Property quick math</p><h1>Conversions & Ratios</h1></div></div>
    <div className="conversion-grid">
      <article className="conversion-card"><div className="conversion-title"><Square size={20} /><h2>Land area</h2></div>
        <NumberField label="Square feet" value={squareFeet} onChange={setSquareFeet} suffix="sf" min={0} step="1" />
        <p className="conversion-answer"><strong>{(squareFeet / 43560).toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong> acres</p></article>
      <article className="conversion-card"><div className="conversion-title"><Ruler size={20} /><h2>Distance</h2></div>
        <NumberField label="Miles" value={miles} onChange={setMiles} suffix="mi" min={0} step="0.1" />
        <p className="conversion-answer"><strong>{(miles * 5280).toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong> feet</p></article>
      <article className="conversion-card conversion-card-wide"><div className="conversion-title"><Home size={20} /><h2>Price per square foot</h2></div>
        <div className="two-fields"><NumberField label="Sale price" value={price} onChange={setPrice} prefix="$" min={0} step="1000" /><NumberField label="GLA" value={gla} onChange={setGla} suffix="sf" min={0} step="1" /></div>
        <p className="conversion-answer"><strong>{money.format(gla > 0 ? price / gla : 0)}</strong> per sq ft</p></article>
    </div>
  </section>;
}

function CompGridTool() {
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [comps, setComps] = useState(DEFAULT_COMPS);
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [copied, setCopied] = useState(false);
  const results = useMemo(() => comps.map((comp) => getAdjustments(subject, comp, rates)), [subject, comps, rates]);
  const updateSubject = (key: keyof GridProperty, value: number | string) =>
    setSubject((current) => ({ ...current, [key]: value }));
  const updateComp = (id: number, key: keyof GridComp, value: number | string) =>
    setComps((current) => current.map((comp) => comp.id === id ? { ...comp, [key]: value } : comp));
  const adjustmentClass = (value: number) => value > 0 ? "positive" : value < 0 ? "negative" : "zero";
  const addComp = () => {
    const id = Math.max(0, ...comps.map((comp) => comp.id)) + 1;
    setComps((current) => [...current, {
      ...DEFAULT_SUBJECT, id, label: `Comp ${current.length + 1}`,
      salePrice: 350000,
    }]);
  };
  const copySummary = async () => {
    const text = comps.map((comp, index) => {
      const result = results[index];
      const netPercent = comp.salePrice ? result.total / comp.salePrice * 100 : 0;
      const grossPercent = comp.salePrice ? result.gross / comp.salePrice * 100 : 0;
      return `${comp.label}: ${money.format(comp.salePrice)} sale | ${signedMoney(result.total)} net (${netPercent.toFixed(1)}%) | ${grossPercent.toFixed(1)}% gross | ${money.format(result.adjustedPrice)} adjusted`;
    }).join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };
  const numericRow = (label: string, key: NumericGridKey, adjustmentKey: AdjustmentKey, step = "1") =>
    <tr key={key}>
      <th>{label}</th>
      <td><input aria-label={`Subject ${label}`} type="number" step={step} value={subject[key]}
        onChange={(event) => updateSubject(key, Number(event.target.value))} /></td>
      {comps.map((comp, index) => <Fragment key={`${key}-${comp.id}`}>
        <td><input aria-label={`${comp.label} ${label}`} type="number" step={step} value={comp[key]}
          onChange={(event) => updateComp(comp.id, key, Number(event.target.value))} /></td>
        <td className={`adjustment-cell ${adjustmentClass(results[index].adjustments[adjustmentKey])}`}>{signedMoney(results[index].adjustments[adjustmentKey])}</td>
      </Fragment>)}
    </tr>;

  return <section className="tool-card wide-card comp-grid-tool">
    <div className="tool-heading heading-with-action">
      <div className="heading-group"><div className="tool-icon blue"><TableProperties size={24} /></div>
        <div><p className="eyebrow">Appraisal workbench</p><h1>Comp Adjustment Grid</h1></div></div>
      <div className="heading-actions">
        <button type="button" className="quiet-button" onClick={copySummary}><Copy size={16} />{copied ? "Copied" : "Copy results"}</button>
        <button type="button" className="secondary-button" onClick={addComp}><Plus size={17} />Add comp</button>
      </div>
    </div>

    <div className="rate-panel">
      <div className="rate-panel-title"><SlidersHorizontal size={18} /><div><strong>Supported adjustment rates</strong><span>Change the rates before relying on the grid.</span></div></div>
      <div className="rate-grid">
        <NumberField label="GLA" value={rates.gla} onChange={(value) => setRates((current) => ({ ...current, gla: value }))} prefix="$" suffix="/sf" step="5" />
        <NumberField label="Site" value={rates.siteAcres} onChange={(value) => setRates((current) => ({ ...current, siteAcres: value }))} prefix="$" suffix="/ac" step="1000" />
        <NumberField label="Effective age" value={rates.age} onChange={(value) => setRates((current) => ({ ...current, age: value }))} prefix="$" suffix="/yr" step="100" />
        <NumberField label="Bedroom" value={rates.beds} onChange={(value) => setRates((current) => ({ ...current, beds: value }))} prefix="$" step="1000" />
        <NumberField label="Full-bath equivalent" value={rates.baths} onChange={(value) => setRates((current) => ({ ...current, baths: value }))} prefix="$" step="1000" />
        <NumberField label="Garage stall" value={rates.garage} onChange={(value) => setRates((current) => ({ ...current, garage: value }))} prefix="$" step="1000" />
        <NumberField label="Condition step" value={rates.condition} onChange={(value) => setRates((current) => ({ ...current, condition: value }))} prefix="$" step="1000" />
      </div>
    </div>

    <div className="adjustment-table-wrap">
      <table className="adjustment-table">
        <thead>
          <tr><th rowSpan={2}>Line item</th><th rowSpan={2}>Subject</th>
            {comps.map((comp) => <th key={comp.id} colSpan={2}>
              <span className="comp-title-cell"><input aria-label="Comparable label" value={comp.label}
                onChange={(event) => updateComp(comp.id, "label", event.target.value)} />
                {comps.length > 1 && <button type="button" aria-label={`Remove ${comp.label}`}
                  onClick={() => setComps((current) => current.filter((item) => item.id !== comp.id))}><Trash2 size={15} /></button>}</span>
            </th>)}
          </tr>
          <tr>{comps.map((comp) => <Fragment key={`subhead-${comp.id}`}><th>Comparable</th><th>Adjustment</th></Fragment>)}</tr>
        </thead>
        <tbody>
          <tr><th>Sale price</th><td className="subject-dash">—</td>{comps.map((comp) => <Fragment key={`price-${comp.id}`}>
            <td><input aria-label={`${comp.label} sale price`} type="number" step="1000" value={comp.salePrice}
              onChange={(event) => updateComp(comp.id, "salePrice", Number(event.target.value))} /></td><td className="subject-dash">—</td>
          </Fragment>)}</tr>
          {numericRow("GLA (sf)", "gla", "gla")}
          {numericRow("Site (ac)", "siteAcres", "siteAcres", ".01")}
          {numericRow("Effective age", "age", "age")}
          {numericRow("Bedrooms", "beds", "beds")}
          <tr><th>Bathrooms</th>
            <td><span className="bath-cell"><input aria-label="Subject full bathrooms" type="number" step="1" value={subject.fullBaths} onChange={(event) => updateSubject("fullBaths", Number(event.target.value))} /><small>F</small><input aria-label="Subject half bathrooms" type="number" step="1" value={subject.halfBaths} onChange={(event) => updateSubject("halfBaths", Number(event.target.value))} /><small>H</small></span></td>
            {comps.map((comp, index) => <Fragment key={`bath-${comp.id}`}>
              <td><span className="bath-cell"><input aria-label={`${comp.label} full bathrooms`} type="number" step="1" value={comp.fullBaths} onChange={(event) => updateComp(comp.id, "fullBaths", Number(event.target.value))} /><small>F</small><input aria-label={`${comp.label} half bathrooms`} type="number" step="1" value={comp.halfBaths} onChange={(event) => updateComp(comp.id, "halfBaths", Number(event.target.value))} /><small>H</small></span></td>
              <td className={`adjustment-cell ${adjustmentClass(results[index].adjustments.baths)}`}>{signedMoney(results[index].adjustments.baths)}</td>
            </Fragment>)}
          </tr>
          {numericRow("Garage stalls", "garage", "garage")}
          <tr><th>Condition</th><td><select aria-label="Subject condition" value={subject.condition} onChange={(event) => updateSubject("condition", event.target.value)}>{[1,2,3,4,5,6].map((rating) => <option key={rating}>C{rating}</option>)}</select></td>
            {comps.map((comp, index) => <Fragment key={`condition-${comp.id}`}><td><select aria-label={`${comp.label} condition`} value={comp.condition} onChange={(event) => updateComp(comp.id, "condition", event.target.value)}>{[1,2,3,4,5,6].map((rating) => <option key={rating}>C{rating}</option>)}</select></td><td className={`adjustment-cell ${adjustmentClass(results[index].adjustments.condition)}`}>{signedMoney(results[index].adjustments.condition)}</td></Fragment>)}
          </tr>
          <tr className="total-row"><th>Net adjustment</th><td>—</td>{comps.map((comp, index) => <Fragment key={`net-${comp.id}`}><td>{comp.salePrice ? `${(results[index].total / comp.salePrice * 100).toFixed(1)}%` : "—"}</td><td className={`adjustment-cell ${adjustmentClass(results[index].total)}`}>{signedMoney(results[index].total)}</td></Fragment>)}</tr>
          <tr className="total-row"><th>Gross adjustment</th><td>—</td>{comps.map((comp, index) => <Fragment key={`gross-${comp.id}`}><td colSpan={2}>{comp.salePrice ? `${(results[index].gross / comp.salePrice * 100).toFixed(1)}%` : "—"}</td></Fragment>)}</tr>
          <tr className="adjusted-row"><th>Adjusted price</th><td>—</td>{comps.map((comp, index) => <Fragment key={`adjusted-${comp.id}`}><td colSpan={2}>{money.format(results[index].adjustedPrice)}</td></Fragment>)}</tr>
        </tbody>
      </table>
    </div>
    <p className="professional-note"><Hammer size={16} />Calculation aid only. Support each adjustment from market evidence and reconcile the indications using appraisal judgment.</p>
  </section>;
}

function FeeIqTool() {
  const [values, setValues] = useState({
    fee: 650, roundTripMiles: 55, driveHours: 1.25, inspectionHours: .75,
    reportHours: 2.5, adminHours: .5, mileageCost: .7, otherCosts: 25, targetRate: 125,
  });
  const [copied, setCopied] = useState(false);
  const update = (key: keyof typeof values, value: number) => setValues((current) => ({ ...current, [key]: value }));
  const totalHours = values.driveHours + values.inspectionHours + values.reportHours + values.adminHours;
  const vehicleCost = values.roundTripMiles * values.mileageCost;
  const totalCosts = vehicleCost + values.otherCosts;
  const contribution = values.fee - totalCosts;
  const effectiveRate = totalHours > 0 ? contribution / totalHours : 0;
  const targetFee = totalHours * values.targetRate + totalCosts;
  const suggestedFee = Math.ceil(Math.max(0, targetFee) / 25) * 25;
  const ratio = values.targetRate > 0 ? effectiveRate / values.targetRate : 0;
  const decision = ratio >= 1.2
    ? { label: "Strong fit", detail: "The assignment clears your target with room for surprises.", tone: "strong" }
    : ratio >= 1
      ? { label: "Acceptable", detail: "The assignment meets your current hourly target.", tone: "good" }
      : ratio >= .8
        ? { label: "Renegotiate", detail: `Quote at least ${money.format(suggestedFee)} to reach your target.`, tone: "reprice" }
        : { label: "Pass or reprice", detail: `The current fee misses your target by ${money.format(Math.max(0, targetFee - values.fee))}.`, tone: "pass" };
  const copyDecision = async () => {
    const text = `Assignment Fee IQ: ${decision.label} | Fee ${money.format(values.fee)} | ${totalHours.toFixed(2)} total hours | ${money.format(totalCosts)} direct cost | ${money.format(effectiveRate)}/hr effective | Suggested fee ${money.format(suggestedFee)}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };

  return <section className="tool-card wide-card fee-iq-tool">
    <div className="tool-heading heading-with-action">
      <div className="heading-group"><div className="tool-icon orange"><BadgeDollarSign size={24} /></div>
        <div><p className="eyebrow">Business intelligence</p><h1>Assignment Fee IQ</h1></div></div>
      <button type="button" className="quiet-button" onClick={copyDecision}><Copy size={16} />{copied ? "Copied" : "Copy decision"}</button>
    </div>
    <div className="fee-iq-layout">
      <div className="fee-input-panel">
        <h2>Assignment inputs</h2>
        <div className="fee-field-grid">
          <NumberField label="Quoted fee" value={values.fee} onChange={(value) => update("fee", value)} prefix="$" step="25" min={0} />
          <NumberField label="Round-trip mileage" value={values.roundTripMiles} onChange={(value) => update("roundTripMiles", value)} suffix="mi" step="1" min={0} />
          <NumberField label="Drive time" value={values.driveHours} onChange={(value) => update("driveHours", value)} suffix="hrs" step=".25" min={0} />
          <NumberField label="Inspection time" value={values.inspectionHours} onChange={(value) => update("inspectionHours", value)} suffix="hrs" step=".25" min={0} />
          <NumberField label="Research & report" value={values.reportHours} onChange={(value) => update("reportHours", value)} suffix="hrs" step=".25" min={0} />
          <NumberField label="Admin & revisions" value={values.adminHours} onChange={(value) => update("adminHours", value)} suffix="hrs" step=".25" min={0} />
          <NumberField label="Vehicle cost" value={values.mileageCost} onChange={(value) => update("mileageCost", value)} prefix="$" suffix="/mi" step=".01" min={0} />
          <NumberField label="Other direct costs" value={values.otherCosts} onChange={(value) => update("otherCosts", value)} prefix="$" step="5" min={0} />
          <NumberField label="Target productive rate" value={values.targetRate} onChange={(value) => update("targetRate", value)} prefix="$" suffix="/hr" step="5" min={0} />
        </div>
      </div>
      <aside className={`fee-decision decision-${decision.tone}`}>
        <span className="decision-kicker">Fee verdict</span><strong>{decision.label}</strong><p>{decision.detail}</p>
        <div className="decision-score"><span>Target coverage</span><b>{Math.max(0, ratio * 100).toFixed(0)}%</b></div>
        <div className="score-track"><span style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} /></div>
      </aside>
    </div>
    <div className="result-row fee-results" aria-live="polite">
      <ResultStat label="Total assignment time" value={`${totalHours.toFixed(2)} hrs`} />
      <ResultStat label="Direct assignment costs" value={money.format(totalCosts)} />
      <ResultStat label="Effective hourly return" value={`${money.format(effectiveRate)}/hr`} tone="orange" />
      <ResultStat label="Target fee" value={money.format(targetFee)} tone="blue" />
      <ResultStat label="Quote in $25 steps" value={money.format(suggestedFee)} tone="blue" />
    </div>
    <div className="fee-breakdown"><span>Vehicle cost <strong>{money.format(vehicleCost)}</strong></span><span>Fee after direct costs <strong>{money.format(contribution)}</strong></span><span>Gap to target <strong>{money.format(Math.max(0, targetFee - values.fee))}</strong></span></div>
    <p className="professional-note"><CircleDollarSign size={16} />Profitability screen before taxes and general overhead. Change the target and cost assumptions to match your business.</p>
  </section>;
}

function MileageTool() {
  const [miles, setMiles] = useState(120), [mpg, setMpg] = useState(19), [gas, setGas] = useState(3.65), [wear, setWear] = useState(.35), [tolls, setTolls] = useState(8), [hours, setHours] = useState(3), [hourly, setHourly] = useState(75);
  const fuel = mpg > 0 ? miles / mpg * gas : 0;
  const wearCost = miles * wear;
  const timeCost = hours * hourly;
  const total = fuel + wearCost + tolls + timeCost;
  return <section className="tool-card wide-card"><div className="tool-heading"><div className="tool-icon blue"><MapPinned size={24}/></div><div><p className="eyebrow">Route profitability</p><h1>True Trip Cost</h1></div></div>
    <div className="market-grid"><NumberField label="Round-trip miles" value={miles} onChange={setMiles} suffix="mi"/><NumberField label="Vehicle MPG" value={mpg} onChange={setMpg} suffix="mpg"/><NumberField label="Fuel price" value={gas} onChange={setGas} prefix="$"/><NumberField label="Wear per mile" value={wear} onChange={setWear} prefix="$"/><NumberField label="Tolls & parking" value={tolls} onChange={setTolls} prefix="$"/><NumberField label="Travel hours" value={hours} onChange={setHours} suffix="hrs"/><NumberField label="Your hourly value" value={hourly} onChange={setHourly} prefix="$"/></div>
    <div className="result-row four-results"><ResultStat label="Fuel" value={money.format(fuel)}/><ResultStat label="Vehicle wear" value={money.format(wearCost)}/><ResultStat label="Travel-time value" value={money.format(timeCost)}/><ResultStat label="True trip cost" value={money.format(total)} tone="blue"/></div>
    <p className="professional-note"><MapPinned size={16}/>Use your actual vehicle and time costs when quoting remote assignments.</p></section>;
}

function TurnaroundTool() {
  const today = new Date().toISOString().slice(0,10);
  const [start, setStart] = useState(today), [businessDays, setBusinessDays] = useState(5), [weekends, setWeekends] = useState(false);
  const due = useMemo(() => {
    const date = new Date(`${start}T12:00:00`);
    if (Number.isNaN(date.valueOf())) return "—";
    let added = 0;
    while (added < Math.max(0, businessDays)) {
      date.setDate(date.getDate() + 1);
      if (weekends || (date.getDay() !== 0 && date.getDay() !== 6)) added++;
    }
    return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }, [start, businessDays, weekends]);
  return <section className="tool-card"><div className="tool-heading"><div className="tool-icon orange"><CalendarClock size={24}/></div><div><p className="eyebrow">Delivery-date math</p><h1>Turnaround Planner</h1></div></div>
    <div className="stacked-fields"><label className="field"><span>Start or inspection date</span><input type="date" value={start} onChange={event => setStart(event.target.value)}/></label><NumberField label="Turnaround" value={businessDays} onChange={setBusinessDays} suffix="days" step="1" min={0}/><label className="check-line"><input type="checkbox" checked={weekends} onChange={event => setWeekends(event.target.checked)}/>Count weekends</label></div>
    <div className="big-answer"><span>Calculated due date</span><strong>{due}</strong></div><p className="settings-note">Calendar aid only; holidays are not automatically excluded.</p></section>;
}

function QuoteTool() {
  const [base, setBase] = useState(500), [rush, setRush] = useState(0), [travel, setTravel] = useState(0), [complexity, setComplexity] = useState(0), [units, setUnits] = useState(0), [other, setOther] = useState(0), [hours, setHours] = useState(6);
  const total = base + rush + travel + complexity + units + other;
  return <section className="tool-card wide-card"><div className="tool-heading"><div className="tool-icon blue"><ReceiptText size={24}/></div><div><p className="eyebrow">Scope before price</p><h1>Appraisal Fee Builder</h1></div></div>
    <div className="market-grid"><NumberField label="Base product fee" value={base} onChange={setBase} prefix="$" step="25"/><NumberField label="Rush premium" value={rush} onChange={setRush} prefix="$" step="25"/><NumberField label="Travel premium" value={travel} onChange={setTravel} prefix="$" step="25"/><NumberField label="Complexity premium" value={complexity} onChange={setComplexity} prefix="$" step="25"/><NumberField label="Units / accessory premium" value={units} onChange={setUnits} prefix="$" step="25"/><NumberField label="Other scope premium" value={other} onChange={setOther} prefix="$" step="25"/><NumberField label="Expected total hours" value={hours} onChange={setHours} suffix="hrs" step=".25"/></div>
    <div className="result-row three-results"><ResultStat label="Quoted fee" value={money.format(total)} tone="blue"/><ResultStat label="Gross hourly" value={money.format(hours > 0 ? total / hours : 0)} tone="orange"/><ResultStat label="Premiums added" value={money.format(total - base)}/></div>
    <p className="professional-note"><ReceiptText size={16}/>Document assignment complexity and scope; this calculator does not set or recommend fees.</p></section>;
}

export default function HomePage() {
  const [activeTool, setActiveTool] = useState<ToolId>("clock");
  const [commandOpen, setCommandOpen] = useState(false);
  const [rate, setRate] = useState(0);
  const [rateReady, setRateReady] = useState(false);
  useEffect(() => {
    try { const saved = localStorage.getItem("mtp-hourly-rate"); if (saved !== null && Number.isFinite(Number(saved))) setRate(Number(saved)); }
    catch { /* Use default. */ }
    setRateReady(true);
  }, []);
  useEffect(() => {
    if (!rateReady) return;
    try { localStorage.setItem("mtp-hourly-rate", String(rate)); } catch { /* Optional. */ }
  }, [rate, rateReady]);
  useEffect(() => {
    const openCommandCenter = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setCommandOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", openCommandCenter);
    return () => window.removeEventListener("keydown", openCommandCenter);
  }, []);
  const activeDefinition = TOOLS.find((tool) => tool.id === activeTool) ?? TOOLS[0];
  const selectTool = (tool: ToolId) => { setActiveTool(tool); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <main className="site-shell">
    <header className="site-header">
      <a className="brand" href="#top" aria-label="MyToolPage home"><span className="brand-mark"><Wrench size={21} /></span><span><strong>MyToolPage</strong><small>.com</small></span></a>
      <div className="header-actions"><div className="header-message"><span className="status-dot" />Free tools. No sign-up required.</div>
        <button type="button" className="command-trigger" onClick={() => setCommandOpen(true)}><Search size={16} /><span>Find a tool</span><kbd>⌘ K</kbd></button></div>
    </header>
    <CommandCenter open={commandOpen} setOpen={setCommandOpen} onSelect={selectTool} />
    <FloatingToolStrip activeTool={activeTool} onSelect={selectTool} />
    <div className="workspace" id="top">
      <aside className="tool-index">
        <div className="index-intro"><p className="eyebrow">My toolbox</p><h2>Pick a tool.<br />Get it done.</h2><p>Your everyday business and appraisal math in one clean workspace.</p></div>
        <nav aria-label="Available tools">{TOOLS.map((tool, index) => { const Icon = tool.icon; return <button key={tool.id} type="button" className={activeTool === tool.id ? "index-tool index-tool-active" : "index-tool"} onClick={() => selectTool(tool.id)}><span className="index-number">{String(index + 1).padStart(2, "0")}</span><Icon size={20} /><span>{tool.label}</span><ArrowRight size={17} className="index-arrow" /></button>; })}</nav>
        <div className="toolbar-tip"><Search size={20} /><p><strong>Need something fast?</strong><br />Press Ctrl/⌘ + K to search every tool.</p></div>
      </aside>
      <div className="workbench">
        <div className="workbench-topline"><span>OPEN TOOL</span><strong>{activeDefinition.label}</strong><span className="workbench-rule" /><span>READY</span></div>
        {activeTool === "clock" && <TimeClockTool rate={rate} setRate={setRate} />}
        {activeTool === "wages" && <WageTool rate={rate} setRate={setRate} />}
        {activeTool === "payroll" && <PayrollTool />}
        {activeTool === "proration" && <TaxProrationTool />}
        {activeTool === "fieldday" && <FieldDayTool />}
        {activeTool === "repairs" && <RepairCostTool />}
        {activeTool === "market" && <MarketTool />}
        {activeTool === "gla" && <GlaTool />}
        {activeTool === "convert" && <ConvertTool />}
        {activeTool === "grid" && <CompGridTool />}
        {activeTool === "fee" && <FeeIqTool />}
        {activeTool === "mileage" && <MileageTool />}
        {activeTool === "turnaround" && <TurnaroundTool />}
        {activeTool === "quote" && <QuoteTool />}
        <footer className="site-footer"><span>MyToolPage v0.5.0 · 14 tools</span><span>Practical tools for real work.</span></footer>
      </div>
    </div>
  </main>;
}
