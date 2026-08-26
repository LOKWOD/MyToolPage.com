"use client";

import {
  AlarmClock, ArrowRight, Calculator, ChevronDown, ChevronUp,
  CircleDollarSign, Clock3, Copy, Grip, Hammer, Home, Maximize2,
  Pause, Play, Plus, RefreshCcw, Ruler, Square, Trash2,
  TrendingUp, Wrench,
} from "lucide-react";
import {
  PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState,
} from "react";

type ToolId = "clock" | "wages" | "market" | "gla" | "convert";
type TimeRow = { day: string; start: string; end: string; breakMinutes: number };
type AreaRow = { id: number; label: string; length: number; width: number; count: number };

const TOOLS = [
  { id: "clock" as const, label: "Time Clock", short: "Clock", icon: Clock3 },
  { id: "wages" as const, label: "Wage Calculator", short: "Wages", icon: CircleDollarSign },
  { id: "market" as const, label: "Market Adjustment", short: "Market", icon: TrendingUp },
  { id: "gla" as const, label: "GLA Worksheet", short: "GLA", icon: Ruler },
  { id: "convert" as const, label: "Property Converter", short: "Convert", icon: Calculator },
];

const DEFAULT_TIMES: TimeRow[] = [
  { day: "Mon", start: "08:00", end: "16:30", breakMinutes: 30 },
  { day: "Tue", start: "08:00", end: "16:30", breakMinutes: 30 },
  { day: "Wed", start: "08:00", end: "16:30", breakMinutes: 30 },
  { day: "Thu", start: "08:00", end: "16:30", breakMinutes: 30 },
  { day: "Fri", start: "08:00", end: "16:30", breakMinutes: 30 },
  { day: "Sat", start: "", end: "", breakMinutes: 0 },
  { day: "Sun", start: "", end: "", breakMinutes: 0 },
];

const DEFAULT_AREAS: AreaRow[] = [
  { id: 1, label: "Main level", length: 40, width: 28, count: 1 },
  { id: 2, label: "Upper level", length: 32, width: 28, count: 1 },
];

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

export default function HomePage() {
  const [activeTool, setActiveTool] = useState<ToolId>("clock");
  const [rate, setRate] = useState(25);
  useEffect(() => {
    try { const saved = localStorage.getItem("mtp-hourly-rate"); if (saved !== null && Number.isFinite(Number(saved))) setRate(Number(saved)); }
    catch { /* Use default. */ }
  }, []);
  useEffect(() => { try { localStorage.setItem("mtp-hourly-rate", String(rate)); } catch { /* Optional. */ } }, [rate]);
  const activeDefinition = TOOLS.find((tool) => tool.id === activeTool) ?? TOOLS[0];

  return <main className="site-shell">
    <header className="site-header">
      <a className="brand" href="#top" aria-label="MyToolPage home"><span className="brand-mark"><Wrench size={21} /></span><span><strong>MyToolPage</strong><small>.com</small></span></a>
      <div className="header-message"><span className="status-dot" />Free tools. No sign-up required.</div>
    </header>
    <FloatingToolStrip activeTool={activeTool} onSelect={setActiveTool} />
    <div className="workspace" id="top">
      <aside className="tool-index">
        <div className="index-intro"><p className="eyebrow">My toolbox</p><h2>Pick a tool.<br />Get it done.</h2><p>Your everyday business and appraisal math in one clean workspace.</p></div>
        <nav aria-label="Available tools">{TOOLS.map((tool, index) => { const Icon = tool.icon; return <button key={tool.id} type="button" className={activeTool === tool.id ? "index-tool index-tool-active" : "index-tool"} onClick={() => setActiveTool(tool.id)}><span className="index-number">0{index + 1}</span><Icon size={20} /><span>{tool.label}</span><ArrowRight size={17} className="index-arrow" /></button>; })}</nav>
        <div className="toolbar-tip"><Grip size={20} /><p><strong>Grab the floating bar.</strong><br />Move it, resize it, or collapse it.</p></div>
      </aside>
      <div className="workbench">
        <div className="workbench-topline"><span>OPEN TOOL</span><strong>{activeDefinition.label}</strong><span className="workbench-rule" /><span>READY</span></div>
        {activeTool === "clock" && <TimeClockTool rate={rate} setRate={setRate} />}
        {activeTool === "wages" && <WageTool rate={rate} setRate={setRate} />}
        {activeTool === "market" && <MarketTool />}
        {activeTool === "gla" && <GlaTool />}
        {activeTool === "convert" && <ConvertTool />}
        <footer className="site-footer"><span>MyToolPage v0.1</span><span>Practical tools for real work.</span></footer>
      </div>
    </div>
  </main>;
}
