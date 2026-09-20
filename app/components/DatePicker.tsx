"use client";

// Porta fiel de 0000-1-2026--7station/frontend/src/components/DateRangePicker.tsx
// — mesmo componente usado no 7station e no Bem Te Vi, pra manter os três
// sistemas com o mesmo seletor de data (nunca o <input type="date"> nativo
// do navegador/SO, que varia de visual entre Windows/Mac/mobile).

import { CSSProperties, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type DateRange = { startDate: Date | null; endDate: Date | null };

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ─── Conversão ISO <-> Date (pra integrar com states que guardam 'YYYY-MM-DD') ─
/** Date → 'YYYY-MM-DD' (string vazia se null). */
export function dateToIso(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
/** 'YYYY-MM-DD' → Date ao meio-dia (evita drift de fuso); null se vazio/inválido. */
export function isoToDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s + "T12:00:00");
  return isNaN(d.getTime()) ? null : d;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toIsoDay(d: Date) {
  return dateToIso(d);
}
function sameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return false;
  return toIsoDay(a) === toIsoDay(b);
}
function inRange(d: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return false;
  const t = d.getTime();
  return t > start.getTime() && t < end.getTime();
}
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}
function buildMonthGrid(viewMonth: Date) {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const firstWeekday = first.getDay();
  const grid: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first);
    d.setDate(d.getDate() - firstWeekday + i);
    grid.push(d);
  }
  return grid;
}

// ─── Dropdown via portal (escapa overflow/clipping de modais e tabelas) ───────
function PickerDropdown({
  open, triggerRef, width, onClose, children,
}: {
  open: boolean;
  triggerRef: React.RefObject<HTMLElement>;
  width: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Posiciona via fixed a partir do rect do trigger; abre pra cima se faltar espaço.
  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const popH = popRef.current?.offsetHeight ?? 360;
      const gap = 6;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = r.left;
      if (left + width > vw - 8) left = Math.max(8, vw - width - 8);

      let top = r.bottom + gap;
      // Sem espaço abaixo → abre pra cima
      if (top + popH > vh - 8 && r.top - gap - popH > 8) {
        top = r.top - gap - popH;
      }
      setPos({ top, left });
    }
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, triggerRef, width]);

  // Fecha clicando fora (trigger + popup)
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popRef}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 1000,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card)",
        boxShadow: "var(--shadow-md)",
        padding: 16,
        width,
        visibility: pos ? "visible" : "hidden",
        animation: "stt-fade-in 0.12s ease-out",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

// ─── Grade de dias de um mês, sem cabeçalho de navegação (compartilhado) ──────
type RenderDayStyle = (day: Date, isCurrentMonth: boolean, isToday: boolean) => { bg: string; color: string; border: string; bold: boolean };

function MonthGridBody({
  viewMonth, locale, renderDayStyle, onPick, onHover, isDisabled,
}: {
  viewMonth: Date;
  locale: string;
  renderDayStyle: RenderDayStyle;
  onPick: (day: Date) => void;
  onHover?: (day: Date | null) => void;
  isDisabled: (day: Date) => boolean;
}) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={w} style={{
            fontSize: 10, fontWeight: 700, textAlign: "center",
            color: i === 0 || i === 6 ? "var(--red)" : "var(--text-faint)",
            letterSpacing: 0.4, textTransform: "uppercase", paddingBottom: 4,
          }}>{w}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {buildMonthGrid(viewMonth).map((d, idx) => {
          const day = startOfDay(d);
          const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
          const isToday = sameDay(day, new Date());
          const disabled = isDisabled(day);
          const st = renderDayStyle(day, isCurrentMonth, isToday);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => !disabled && onPick(day)}
              onMouseEnter={() => onHover?.(day)}
              onMouseLeave={() => onHover?.(null)}
              disabled={disabled}
              style={{
                height: 32,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: st.bg, color: disabled ? "var(--border-strong)" : st.color, border: st.border,
                borderRadius: 6,
                fontFamily: "inherit", fontSize: 12, fontWeight: st.bold ? 700 : 500,
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "background 0.12s",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─── Cabeçalho de mês + grade de dias, um único mês (usado no DatePicker) ─────
function MonthGrid({
  viewMonth, setViewMonth, locale, renderDayStyle, onPick, onHover, isDisabled,
}: {
  viewMonth: Date;
  setViewMonth: (updater: (m: Date) => Date) => void;
  locale: string;
  renderDayStyle: RenderDayStyle;
  onPick: (day: Date) => void;
  onHover?: (day: Date | null) => void;
  isDisabled: (day: Date) => boolean;
}) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button type="button" onClick={() => setViewMonth((m) => addMonths(m, -1))} style={navBtn} aria-label="Mês anterior">
          <i className="bi bi-chevron-left" style={{ fontSize: 12 }} />
        </button>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textTransform: "capitalize" }}>
          {viewMonth.toLocaleDateString(locale, { month: "long", year: "numeric" })}
        </div>
        <button type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))} style={navBtn} aria-label="Próximo mês">
          <i className="bi bi-chevron-right" style={{ fontSize: 12 }} />
        </button>
      </div>
      <MonthGridBody viewMonth={viewMonth} locale={locale} renderDayStyle={renderDayStyle} onPick={onPick} onHover={onHover} isDisabled={isDisabled} />
    </>
  );
}

// ─── Dois meses lado a lado, navegação compartilhada (igual Clockify) ─────────
function TwoMonthGrid({
  viewMonth, setViewMonth, locale, renderDayStyle, onPick, onHover, isDisabled,
}: {
  viewMonth: Date;
  setViewMonth: (updater: (m: Date) => Date) => void;
  locale: string;
  renderDayStyle: RenderDayStyle;
  onPick: (day: Date) => void;
  onHover?: (day: Date | null) => void;
  isDisabled: (day: Date) => boolean;
}) {
  const mesDois = addMonths(viewMonth, 1);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button type="button" onClick={() => setViewMonth((m) => addMonths(m, -1))} style={navBtn} aria-label="Mês anterior">
          <i className="bi bi-chevron-left" style={{ fontSize: 12 }} />
        </button>
        <div style={{ flex: 1, display: "flex" }}>
          <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--text)", textTransform: "capitalize" }}>
            {viewMonth.toLocaleDateString(locale, { month: "long", year: "numeric" })}
          </div>
          <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--text)", textTransform: "capitalize" }}>
            {mesDois.toLocaleDateString(locale, { month: "long", year: "numeric" })}
          </div>
        </div>
        <button type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))} style={navBtn} aria-label="Próximo mês">
          <i className="bi bi-chevron-right" style={{ fontSize: 12 }} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <MonthGridBody viewMonth={viewMonth} locale={locale} renderDayStyle={renderDayStyle} onPick={onPick} onHover={onHover} isDisabled={isDisabled} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <MonthGridBody viewMonth={mesDois} locale={locale} renderDayStyle={renderDayStyle} onPick={onPick} onHover={onHover} isDisabled={isDisabled} />
        </div>
      </div>
    </>
  );
}

// ─── DateRangePicker (intervalo) ──────────────────────────────────────────────
export function DateRangePicker({
  startDate, endDate, onChange, size = "md", locale = "pt-BR", allowFuture = true,
}: {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (range: DateRange) => void;
  size?: "sm" | "md";
  locale?: string;
  allowFuture?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfDay(startDate ?? new Date()));
  const [pendingStart, setPendingStart] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (startDate) setViewMonth(startOfDay(new Date(startDate.getFullYear(), startDate.getMonth(), 1)));
  }, [startDate]);

  const triggerLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
    if (startDate && endDate) return `${fmt(startDate)} — ${fmt(endDate)}`;
    if (startDate) return `${fmt(startDate)} — escolha o fim`;
    return "Selecionar período";
  }, [startDate, endDate, locale]);

  function selectDay(d: Date) {
    const day = startOfDay(d);
    if (!allowFuture && day.getTime() > startOfDay(new Date()).getTime()) return;
    if (!pendingStart) {
      setPendingStart(day);
      setHoverDate(null);
    } else {
      const start = pendingStart < day ? pendingStart : day;
      const end = pendingStart < day ? day : pendingStart;
      onChange({ startDate: start, endDate: end });
      setPendingStart(null);
      setHoverDate(null);
      setOpen(false);
    }
  }

  function applyPreset(
    preset: "hoje" | "ontem" | "semana" | "semana-passada" | "ultimas-2-semanas" | "mes" | "mes-passado" | "ano" | "ano-passado"
  ) {
    const today = startOfDay(new Date());
    let s = today;
    let e = today;
    switch (preset) {
      case "hoje": s = today; e = today; break;
      case "ontem": { s = new Date(today); s.setDate(s.getDate() - 1); e = new Date(s); break; }
      case "semana": {
        const dow = today.getDay();
        s = new Date(today); s.setDate(s.getDate() - dow);
        e = new Date(s); e.setDate(e.getDate() + 6);
        break;
      }
      case "semana-passada": {
        const dow = today.getDay();
        e = new Date(today); e.setDate(e.getDate() - dow - 1);
        s = new Date(e); s.setDate(s.getDate() - 6);
        break;
      }
      case "ultimas-2-semanas": { e = today; s = new Date(today); s.setDate(s.getDate() - 13); break; }
      case "mes": {
        s = new Date(today.getFullYear(), today.getMonth(), 1);
        e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      }
      case "mes-passado": {
        s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        e = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      }
      case "ano": { s = new Date(today.getFullYear(), 0, 1); e = new Date(today.getFullYear(), 11, 31); break; }
      case "ano-passado": { s = new Date(today.getFullYear() - 1, 0, 1); e = new Date(today.getFullYear() - 1, 11, 31); break; }
    }
    onChange({ startDate: s, endDate: e });
    setPendingStart(null);
    setOpen(false);
  }

  const rangeStart = pendingStart ?? startDate;
  const rangeEnd = pendingStart ? (hoverDate && hoverDate > pendingStart ? hoverDate : null) : endDate;

  const triggerH = size === "sm" ? 32 : 38;
  const triggerFs = size === "sm" ? 12 : 13;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          height: triggerH, padding: "0 14px",
          background: "var(--surface)",
          border: `1.5px solid ${open ? "var(--orange)" : "var(--border)"}`,
          boxShadow: open ? "0 0 0 3px var(--orange-15)" : "none",
          borderRadius: "var(--r-md)",
          fontFamily: "inherit", fontSize: triggerFs, fontWeight: 600,
          color: startDate ? "var(--text)" : "var(--text-faint)",
          cursor: "pointer", transition: "all 0.12s",
        }}
      >
        <i className="bi bi-calendar3" style={{ fontSize: triggerFs, color: "var(--text-faint)" }} />
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{triggerLabel}</span>
        <i className="bi bi-chevron-down" style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 2 }} />
      </button>

      <PickerDropdown open={open} triggerRef={triggerRef} width={640} onClose={() => { setOpen(false); setPendingStart(null); }}>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ width: 140, flexShrink: 0, display: "flex", flexDirection: "column", gap: 1 }}>
            {[
              { id: "hoje", label: "Hoje" },
              { id: "ontem", label: "Ontem" },
              { id: "semana", label: "Esta semana" },
              { id: "semana-passada", label: "Semana passada" },
              { id: "ultimas-2-semanas", label: "Últimas duas semanas" },
              { id: "mes", label: "Este mês" },
              { id: "mes-passado", label: "Último mês" },
              { id: "ano", label: "Este ano" },
              { id: "ano-passado", label: "Ano passado" },
            ].map((p) => (
              <button key={p.id} type="button" onClick={() => applyPreset(p.id as Parameters<typeof applyPreset>[0])} style={presetBtn}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-sunken)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0, borderLeft: "1px solid var(--border)", paddingLeft: 20 }}>
            <TwoMonthGrid
              viewMonth={viewMonth}
              setViewMonth={setViewMonth}
              locale={locale}
              onHover={setHoverDate}
              isDisabled={(day) => !allowFuture && day.getTime() > startOfDay(new Date()).getTime()}
              onPick={selectDay}
              renderDayStyle={(day, isCurrentMonth, isToday) => {
                const isStart = sameDay(day, rangeStart);
                const isEnd = sameDay(day, rangeEnd);
                const isIn = inRange(day, rangeStart, rangeEnd);
                let bg = "transparent", color = "var(--text)", border = "1px solid transparent";
                if (isStart || isEnd) { bg = "var(--orange)"; color = "#fff"; }
                else if (isIn) { bg = "var(--orange-15)"; color = "var(--text)"; }
                else if (isToday) { border = "1px solid var(--orange)"; }
                if (!isCurrentMonth && !isStart && !isEnd && !isIn) color = "var(--text-faint)";
                return { bg, color, border, bold: isStart || isEnd };
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-faint)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            {pendingStart ? `Início: ${pendingStart.toLocaleDateString(locale)} · escolha o fim` : "Clique em duas datas para definir o período"}
          </span>
          {(startDate || endDate) && (
            <button type="button" onClick={() => { onChange({ startDate: null, endDate: null }); setOpen(false); setPendingStart(null); }}
              style={{ background: "transparent", border: "none", color: "var(--text-faint)", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: 0 }}>
              Limpar
            </button>
          )}
        </div>
      </PickerDropdown>
    </>
  );
}

// ─── DatePicker (data única) — mesmo estilo, sem range ────────────────────────
export function DatePicker({
  value, onChange, size = "md", locale = "pt-BR", allowFuture = true, placeholder = "Selecionar data", full = false, disabled = false,
}: {
  value: Date | null;
  onChange: (d: Date | null) => void;
  size?: "sm" | "md";
  locale?: string;
  allowFuture?: boolean;
  placeholder?: string;
  /** Ocupa 100% da largura do container. */
  full?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfDay(value ?? new Date()));
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (value) setViewMonth(startOfDay(new Date(value.getFullYear(), value.getMonth(), 1)));
  }, [value]);

  const triggerLabel = value
    ? value.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" })
    : placeholder;

  const triggerH = size === "sm" ? 32 : 40;
  const triggerFs = size === "sm" ? 12 : 13.5;

  function pick(d: Date) {
    const day = startOfDay(d);
    if (!allowFuture && day.getTime() > startOfDay(new Date()).getTime()) return;
    onChange(day);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          height: triggerH, padding: "0 14px",
          width: full ? "100%" : undefined,
          background: disabled ? "var(--surface-sunken)" : "var(--surface)",
          border: `1.5px solid ${open ? "var(--orange)" : "var(--border)"}`,
          boxShadow: open ? "0 0 0 3px var(--orange-15)" : "none",
          borderRadius: "var(--r-md)",
          fontFamily: "inherit", fontSize: triggerFs, fontWeight: 500,
          color: value ? "var(--text)" : "var(--text-faint)",
          cursor: disabled ? "default" : "pointer", transition: "all 0.12s",
        }}
      >
        <i className="bi bi-calendar3" style={{ fontSize: triggerFs, color: "var(--text-faint)" }} />
        <span style={{ fontVariantNumeric: "tabular-nums", flex: full ? 1 : undefined, textAlign: "left" }}>{triggerLabel}</span>
        <i className="bi bi-chevron-down" style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 2 }} />
      </button>

      <PickerDropdown open={open} triggerRef={triggerRef} width={280} onClose={() => setOpen(false)}>
        <MonthGrid
          viewMonth={viewMonth}
          setViewMonth={setViewMonth}
          locale={locale}
          isDisabled={(day) => !allowFuture && day.getTime() > startOfDay(new Date()).getTime()}
          onPick={pick}
          renderDayStyle={(day, isCurrentMonth, isToday) => {
            const isSel = sameDay(day, value);
            let bg = "transparent", color = "var(--text)", border = "1px solid transparent";
            if (isSel) { bg = "var(--orange)"; color = "#fff"; }
            else if (isToday) { border = "1px solid var(--orange)"; }
            if (!isCurrentMonth && !isSel) color = "var(--text-faint)";
            return { bg, color, border, bold: isSel };
          }}
        />
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" onClick={() => pick(new Date())}
            style={{ background: "transparent", border: "none", color: "var(--orange)", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: 0 }}>
            Hoje
          </button>
          {value && (
            <button type="button" onClick={() => { onChange(null); setOpen(false); }}
              style={{ background: "transparent", border: "none", color: "var(--text-faint)", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: 0 }}>
              Limpar
            </button>
          )}
        </div>
      </PickerDropdown>
    </>
  );
}

// ─── MonthPicker (mês/ano) — mesmo estilo, valor 'YYYY-MM' ────────────────────
const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function MonthPicker({
  value, onChange, size = "md", locale = "pt-BR", full = false, placeholder = "Selecionar mês",
}: {
  /** 'YYYY-MM' ou ''. */
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "md";
  locale?: string;
  full?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => {
    const m = /^(\d{4})-(\d{2})$/.exec(value || "");
    if (!m) return null;
    return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) - 1 };
  }, [value]);
  const [viewYear, setViewYear] = useState<number>(parsed?.year ?? new Date().getFullYear());
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (parsed) setViewYear(parsed.year); }, [parsed]);

  const triggerLabel = parsed
    ? new Date(parsed.year, parsed.month, 1).toLocaleDateString(locale, { month: "long", year: "numeric" })
    : placeholder;

  const triggerH = size === "sm" ? 32 : 40;
  const triggerFs = size === "sm" ? 12 : 13.5;

  function pick(monthIdx: number) {
    onChange(`${viewYear}-${String(monthIdx + 1).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          height: triggerH, padding: "0 14px", width: full ? "100%" : undefined,
          background: "var(--surface)",
          border: `1.5px solid ${open ? "var(--orange)" : "var(--border)"}`,
          boxShadow: open ? "0 0 0 3px var(--orange-15)" : "none",
          borderRadius: "var(--r-md)",
          fontFamily: "inherit", fontSize: triggerFs, fontWeight: 500,
          color: parsed ? "var(--text)" : "var(--text-faint)",
          cursor: "pointer", transition: "all 0.12s", textTransform: "capitalize",
        }}
      >
        <i className="bi bi-calendar3" style={{ fontSize: triggerFs, color: "var(--text-faint)" }} />
        <span style={{ flex: full ? 1 : undefined, textAlign: "left" }}>{triggerLabel}</span>
        <i className="bi bi-chevron-down" style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 2 }} />
      </button>

      <PickerDropdown open={open} triggerRef={triggerRef} width={260} onClose={() => setOpen(false)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button type="button" onClick={() => setViewYear((y) => y - 1)} style={navBtn} aria-label="Ano anterior">
            <i className="bi bi-chevron-left" style={{ fontSize: 12 }} />
          </button>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{viewYear}</div>
          <button type="button" onClick={() => setViewYear((y) => y + 1)} style={navBtn} aria-label="Próximo ano">
            <i className="bi bi-chevron-right" style={{ fontSize: 12 }} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {MONTH_LABELS.map((m, i) => {
            const isSel = parsed?.year === viewYear && parsed?.month === i;
            return (
              <button
                key={m}
                type="button"
                onClick={() => pick(i)}
                style={{
                  height: 38,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isSel ? "var(--orange)" : "transparent",
                  color: isSel ? "#fff" : "var(--text)",
                  border: `1px solid ${isSel ? "var(--orange)" : "var(--border)"}`,
                  borderRadius: "var(--r-sm)",
                  fontFamily: "inherit", fontSize: 12.5, fontWeight: isSel ? 700 : 500,
                  cursor: "pointer", textTransform: "capitalize", transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-sunken)"; }}
                onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                {m}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" onClick={() => {
            const now = new Date();
            setViewYear(now.getFullYear());
            onChange(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
            setOpen(false);
          }} style={{ background: "transparent", border: "none", color: "var(--orange)", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: 0 }}>
            Este mês
          </button>
          {value && (
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              style={{ background: "transparent", border: "none", color: "var(--text-faint)", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: 0 }}>
              Limpar
            </button>
          )}
        </div>
      </PickerDropdown>
    </>
  );
}

// ─── Styles compartilhados ───────────────────────────────────────────────────
const presetBtn: CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "7px 10px",
  background: "transparent",
  border: "none",
  borderRadius: "var(--r-sm)",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
  cursor: "pointer",
  transition: "background 0.12s",
};
const navBtn: CSSProperties = {
  width: 26, height: 26,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-muted)",
  cursor: "pointer",
};

export default DateRangePicker;
