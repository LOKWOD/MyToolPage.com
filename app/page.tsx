"use client";

import {
  AlarmClock, ArrowRight, BadgeDollarSign, Calculator, ChevronDown, ChevronUp,
  CircleDollarSign, Clock3, Copy, Grip, Hammer, Home, Maximize2,
  Pause, Play, Plus, RefreshCcw, Ruler, Search, SlidersHorizontal, Square, TableProperties,
  Trash2, TrendingUp, Wrench, MapPinned, CalendarClock, ReceiptText,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandShortcut,
} from "@/components/ui/command";
import {
  Fragment, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState,
} from "react";

type ToolId = "clock" | "wages" | "market" | "gla" | "convert" | "grid" | "fee" | "mileage" | "turnaround" | "quote";
type TimeRow = { day: string; start: string; end: string; breakMinutes: number };
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
  { id: "wages" as const, label: "Wage Calculator", short: "Wages", icon: CircleDollarSign, description: "Total weekly hours, overtime, and gross pay" },
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
            <CommandShortcut>0{index + 1}</CommandShortcut>
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
  }, []);

  useEffect(() => {
    try { localStorage.setItem("mtp-toolbar", JSON.stringify({ position, size })); }
    catch { /* Storage is optional. */ }
  }, [position, size]);

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

  useEffect(() => {
    setNow(Date.now());
    try {
      const saved = localStorage.getItem("mtp-clock");
      if (saved) {
        const parsed = JSON.parse(saved) as { startedAt: number | null; accumulated: number };
        setStartedAt(parsed.startedAt); setAccumulated(parsed.accumulated || 0);
      }
    } catch { /* Ignore stale state. */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("mtp-clock", JSON.stringify({ startedAt, accumulated })); }
    catch { /* Persistence is optional. */ }
    if (startedAt === null) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [startedAt, accumulated]);

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
  const [overtimeAfter, setOvertimeAfter] = useState(40);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.5);
  const [copied, setCopied] = useState(false);
  const totals = useMemo(() => {
    const totalHours = rows.reduce((sum, row) => sum + hoursForRow(row), 0);
    const regularHours = Math.min(totalHours, Math.max(0, overtimeAfter));
    const overtimeHours = Math.max(0, totalHours - Math.max(0, overtimeAfter));
    return { totalHours, regularHours, overtimeHours,
      grossPay: regularHours * rate + overtimeHours * rate * overtimeMultiplier };
  }, [rows, overtimeAfter, overtimeMultiplier, rate]);
  const updateRow = (index: number, key: keyof TimeRow, value: string | number) =>
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  const copySummary = async () => {
    const text = `Weekly time card: ${totals.totalHours.toFixed(2)} hours | ${totals.regularHours.toFixed(2)} regular | ${totals.overtimeHours.toFixed(2)} overtime | ${money.format(totals.grossPay)} gross pay`;
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };

  return <section className="tool-card wide-card">
    <div className="tool-heading heading-with-action">
      <div className="heading-group"><div className="tool-icon blue"><CircleDollarSign size={24} /></div>
        <div><p className="eyebrow">Hours, overtime & gross pay</p><h1>Weekly Wage Calculator</h1></div></div>
      <button type="button" className="quiet-button" onClick={copySummary}><Copy size={16} />{copied ? "Copied" : "Copy summary"}</button>
    </div>
    <div className="wage-layout">
      <div className="time-table-wrap"><table className="time-table">
        <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Break</th><th>Hours</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.day}>
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
        <p className="settings-note">Gross estimate before taxes and deductions. Confirm applicable wage rules.</p>
      </aside>
    </div>
    <div className="result-row four-results" aria-live="polite">
      <ResultStat label="Total hours" value={totals.totalHours.toFixed(2)} />
      <ResultStat label="Regular" value={totals.regularHours.toFixed(2)} />
      <ResultStat label="Overtime" value={totals.overtimeHours.toFixed(2)} tone="orange" />
      <ResultStat label="Estimated gross" value={money.format(totals.grossPay)} tone="blue" />
    </div>
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
  useEffect(() => {
    try { const saved = localStorage.getItem("mtp-hourly-rate"); if (saved !== null && Number.isFinite(Number(saved))) setRate(Number(saved)); }
    catch { /* Use default. */ }
  }, []);
  useEffect(() => { try { localStorage.setItem("mtp-hourly-rate", String(rate)); } catch { /* Optional. */ } }, [rate]);
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
        <nav aria-label="Available tools">{TOOLS.map((tool, index) => { const Icon = tool.icon; return <button key={tool.id} type="button" className={activeTool === tool.id ? "index-tool index-tool-active" : "index-tool"} onClick={() => selectTool(tool.id)}><span className="index-number">0{index + 1}</span><Icon size={20} /><span>{tool.label}</span><ArrowRight size={17} className="index-arrow" /></button>; })}</nav>
        <div className="toolbar-tip"><Search size={20} /><p><strong>Need something fast?</strong><br />Press Ctrl/⌘ + K to search every tool.</p></div>
      </aside>
      <div className="workbench">
        <div className="workbench-topline"><span>OPEN TOOL</span><strong>{activeDefinition.label}</strong><span className="workbench-rule" /><span>READY</span></div>
        {activeTool === "clock" && <TimeClockTool rate={rate} setRate={setRate} />}
        {activeTool === "wages" && <WageTool rate={rate} setRate={setRate} />}
        {activeTool === "market" && <MarketTool />}
        {activeTool === "gla" && <GlaTool />}
        {activeTool === "convert" && <ConvertTool />}
        {activeTool === "grid" && <CompGridTool />}
        {activeTool === "fee" && <FeeIqTool />}
        {activeTool === "mileage" && <MileageTool />}
        {activeTool === "turnaround" && <TurnaroundTool />}
        {activeTool === "quote" && <QuoteTool />}
        <footer className="site-footer"><span>MyToolPage v0.3.1</span><span>Practical tools for real work.</span></footer>
      </div>
    </div>
  </main>;
}
