"use client";

import { CSSProperties, ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Breadcrumb, BreadcrumbItem } from "./Breadcrumb";
import { DatePicker, dateToIso, isoToDate } from "./DatePicker";

// ─────────────────────────────────────────────────────────────────────────────
// CLOCKRVIEW — primitivas de UI compartilhadas
// Porta fiel de 7station-design-system/components/ui-kit.tsx pro Next.js
// App Router (troca react-router-dom por next/navigation dentro de Breadcrumb;
// o resto do arquivo é idêntico ao pacote oficial).
// ─────────────────────────────────────────────────────────────────────────────

// ─── Card ────────────────────────────────────────────────────────────────────
export function Card({
  children,
  padding = true,
  style,
}: {
  children: ReactNode;
  padding?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card)",
        boxShadow: "var(--shadow-card)",
        padding: padding ? 22 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Btn ─────────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost" | "success";
type BtnSize = "sm" | "md" | "lg";

export function Btn({
  variant = "primary",
  icon,
  iconRight,
  children,
  onClick,
  disabled,
  type = "button",
  size = "md",
  full,
  title,
}: {
  variant?: BtnVariant;
  icon?: string;
  iconRight?: string;
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  size?: BtnSize;
  full?: boolean;
  title?: string;
}) {
  const sz =
    size === "sm" ? { h: 30, px: 12, fs: 12 } : size === "lg" ? { h: 44, px: 18, fs: 14 } : { h: 38, px: 16, fs: 13 };

  const map: Record<BtnVariant, { bg: string; color: string; border: string }> = {
    primary: { bg: "var(--orange)", color: "#fff", border: "var(--orange)" },
    secondary: { bg: "var(--surface)", color: "var(--text)", border: "var(--border-strong)" },
    ghost: { bg: "transparent", color: "var(--text-muted)", border: "transparent" },
    danger: { bg: "var(--red)", color: "#fff", border: "var(--red)" },
    "danger-ghost": { bg: "transparent", color: "var(--red)", border: "color-mix(in oklab, var(--red) 35%, transparent)" },
    success: { bg: "var(--green)", color: "#fff", border: "var(--green)" },
  };
  const v = map[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        height: sz.h,
        padding: `0 ${sz.px}px`,
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: "var(--r-btn)",
        fontFamily: "inherit",
        fontSize: sz.fs,
        fontWeight: 700,
        letterSpacing: 0.2,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        width: full ? "100%" : undefined,
        whiteSpace: "nowrap",
        transition: "transform 0.08s, box-shadow 0.15s, background 0.15s",
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = "translateY(1px)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {icon && <i className={`bi ${icon}`} style={{ fontSize: sz.fs + 1 }} />}
      {children}
      {iconRight && <i className={`bi ${iconRight}`} style={{ fontSize: sz.fs + 1 }} />}
    </button>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
export function Avatar({
  initials,
  color = "#3f6fd9",
  size = 32,
}: {
  initials: string;
  color?: string;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: "#fff",
        fontWeight: 700,
        fontSize: Math.round(size * 0.42),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// initialsFromName/colorFromString/formatDate moraram aqui antes — foram
// movidas pra ./ui-helpers.ts (arquivo sem "use client"). Server Components
// devem importar esses três helpers direto de "@/app/components/ui-helpers",
// nunca daqui — um re-export por este arquivo ainda os embrulharia como
// referência de cliente e quebraria a chamada durante a renderização no
// servidor ("X is not a function").

// ─── RoleChip ────────────────────────────────────────────────────────────────
export type Profile = "colaborador" | "admin" | "dp_pmo" | "financeiro" | "administrativo";

const PROFILE_BADGE: Record<Profile, { icon: string; bg: string; bd: string; fg: string; label: string }> = {
  colaborador: { icon: "bi-person", bg: "rgba(255,255,255,0.08)", bd: "var(--border)", fg: "var(--text-muted)", label: "COLABORADOR" },
  admin: { icon: "bi-stars", bg: "rgba(255, 130, 0, 0.16)", bd: "color-mix(in oklab, var(--orange) 35%, transparent)", fg: "var(--orange)", label: "ADMIN" },
  dp_pmo: { icon: "bi-shield-lock", bg: "rgba(63, 111, 217, 0.18)", bd: "color-mix(in oklab, var(--blue) 35%, transparent)", fg: "var(--blue)", label: "DP/PMO" },
  financeiro: { icon: "bi-cash-coin", bg: "rgba(34, 197, 94, 0.16)", bd: "color-mix(in oklab, var(--green) 35%, transparent)", fg: "var(--green)", label: "FINANCEIRO" },
  administrativo: { icon: "bi-folder-check", bg: "rgba(245, 158, 11, 0.16)", bd: "color-mix(in oklab, var(--yellow) 35%, transparent)", fg: "var(--yellow)", label: "ADMINISTRATIVO" },
};

export function RoleChip({ profile }: { profile: Profile }) {
  const b = PROFILE_BADGE[profile];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        padding: "0 10px",
        borderRadius: 999,
        background: b.bg,
        border: `1px solid ${b.bd}`,
        color: b.fg,
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: 0.6,
      }}
    >
      <i className={`bi ${b.icon}`} style={{ fontSize: 10 }} />
      {b.label}
    </span>
  );
}

// ─── Page header ─────────────────────────────────────────────────────────────
export function CFPageHeader({
  title,
  subtitle,
  actions,
  sideBadge,
  breadcrumb,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  sideBadge?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 32,
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: 1 }}>
        {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: -0.5,
              color: "var(--text)",
              lineHeight: 1.1,
            }}
          >
            {title}
          </h1>
          {sideBadge}
        </div>

        {subtitle && (
          <p
            style={{
              margin: 0,
              maxWidth: 760,
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text-muted)",
              lineHeight: 1.55,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>{actions}</div>}
    </header>
  );
}

// ─── Status badge ────────────────────────────────────────────────────────────
export function CFStatusBadge({ kind, label }: { kind: string; label?: string }) {
  const map: Record<string, { bg: string; fg: string; icon: string; label: string }> = {
    // Status de Projeto (ver lib/statusProjeto.ts) — texto livre, não enum.
    ativo: { bg: "var(--green-15)", fg: "var(--green)", icon: "bi-check-circle-fill", label: "Ativo" },
    standby: { bg: "var(--yellow-15)", fg: "var(--yellow)", icon: "bi-pause-circle-fill", label: "Standby" },
    finalizado: { bg: "var(--blue-15)", fg: "var(--blue)", icon: "bi-flag-fill", label: "Finalizado" },
    cancelado: { bg: "var(--red-15)", fg: "var(--red)", icon: "bi-x-circle-fill", label: "Cancelado" },
    encerrado: { bg: "var(--surface-sunken)", fg: "var(--text-faint)", icon: "bi-archive-fill", label: "Encerrado" },
    inativo: { bg: "var(--surface-sunken)", fg: "var(--text-faint)", icon: "bi-dash-circle", label: "Inativo" },
    rascunho: { bg: "var(--surface-sunken)", fg: "var(--text-muted)", icon: "bi-pencil", label: "Rascunho" },
    em_validacao: { bg: "var(--yellow-15)", fg: "var(--yellow)", icon: "bi-hourglass-split", label: "Em validação" },
    aprovado: { bg: "var(--green-15)", fg: "var(--green)", icon: "bi-check-circle-fill", label: "Aprovado" },
    rejeitado: { bg: "var(--red-15)", fg: "var(--red)", icon: "bi-x-circle-fill", label: "Rejeitado" },
  };
  const m = map[kind] ?? { bg: "var(--surface-sunken)", fg: "var(--text-muted)", icon: "bi-dash", label: label ?? String(kind) };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        background: m.bg,
        color: m.fg,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
    >
      <i className={`bi ${m.icon}`} style={{ fontSize: 10 }} />
      {label ?? m.label}
    </span>
  );
}

// ─── Sub-navigation (inner tabs) ─────────────────────────────────────────────
export type SubTab = { id: string; label: string; icon?: string; count?: number; dot?: boolean };

export function CFSubNav({
  tabs,
  active,
  onChange,
  trailing,
}: {
  tabs: SubTab[];
  active: string;
  onChange: (id: string) => void;
  trailing?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        borderBottom: "1px solid var(--border)",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", gap: 0, flex: 1, flexWrap: "wrap" }}>
        {tabs.map((t) => {
          const a = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 16px",
                background: "transparent",
                border: "none",
                color: a ? "var(--text)" : "var(--text-muted)",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0.1,
                borderBottom: `2px solid ${a ? "var(--orange)" : "transparent"}`,
                marginBottom: -1,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "color 0.12s",
              }}
            >
              {t.icon && <i className={`bi ${t.icon}`} style={{ fontSize: 13 }} />}
              {t.label}
              {t.count != null && (
                <span
                  style={{
                    marginLeft: 4,
                    padding: "1px 7px",
                    borderRadius: 999,
                    background: a ? "var(--orange-15)" : "var(--surface-sunken)",
                    color: a ? "var(--orange)" : "var(--text-muted)",
                    fontSize: 10.5,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {t.count}
                </span>
              )}
              {t.dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red)", marginLeft: 2 }} />}
            </button>
          );
        })}
      </div>
      {trailing}
    </div>
  );
}

// ─── Alert inline ────────────────────────────────────────────────────────────
export function CFAlert({
  tone = "warn",
  icon,
  title,
  children,
  cta,
  onCta,
}: {
  tone?: "warn" | "danger" | "info" | "ok";
  icon?: string;
  title?: ReactNode;
  children?: ReactNode;
  cta?: string;
  onCta?: () => void;
}) {
  const map = {
    warn: { bg: "var(--yellow-15)", bd: "color-mix(in oklab, var(--yellow) 35%, transparent)", fg: "var(--yellow)" },
    danger: { bg: "var(--red-15)", bd: "color-mix(in oklab, var(--red) 35%, transparent)", fg: "var(--red)" },
    info: { bg: "var(--blue-15)", bd: "color-mix(in oklab, var(--blue) 35%, transparent)", fg: "var(--blue)" },
    ok: { bg: "var(--green-15)", bd: "color-mix(in oklab, var(--green) 35%, transparent)", fg: "var(--green)" },
  }[tone];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 14px",
        borderRadius: "var(--r-md)",
        background: map.bg,
        border: `1px solid ${map.bd}`,
        color: "var(--text)",
      }}
    >
      {icon && <i className={`bi ${icon}`} style={{ fontSize: 16, color: map.fg, marginTop: 1, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{title}</div>}
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55 }}>{children}</div>
        {cta && (
          <button
            type="button"
            onClick={onCta}
            style={{
              marginTop: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 11px",
              borderRadius: "var(--r-sm)",
              background: "var(--surface)",
              border: `1px solid ${map.bd}`,
              color: map.fg,
              fontWeight: 700,
              fontSize: 11.5,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <i className="bi bi-send" style={{ fontSize: 11 }} /> {cta}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Section title ───────────────────────────────────────────────────────────
export function CFSectionTitle({ children, hint, right }: { children: ReactNode; hint?: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 10,
          fontSize: 11.5,
          fontWeight: 700,
          color: "var(--text-faint)",
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 18, height: 1, background: "var(--border-strong)", alignSelf: "center" }} />
        <span>{children}</span>
        {hint && <span style={{ color: "var(--text-muted)", fontWeight: 500, letterSpacing: 0.3, textTransform: "none" }}>{hint}</span>}
      </div>
      {right}
    </div>
  );
}

// ─── Distribution bar ────────────────────────────────────────────────────────
export function CFDistBar({ segments, height = 10 }: { segments: { label: string; value: number; color: string }[]; height?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", height, borderRadius: 999, overflow: "hidden", border: "1px solid var(--border)" }}>
        {segments.map((s, i) => (
          <div
            key={i}
            title={`${s.label}: ${s.value}`}
            style={{
              flex: s.value || 0.01,
              background: s.color,
              borderRight: i < segments.length - 1 ? "2px solid var(--surface)" : "none",
              transition: "flex 0.3s ease",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color }} />
            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</span>
            <span style={{ color: "var(--text)", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI tile ────────────────────────────────────────────────────────────────
export function CFKpi({
  label,
  value,
  suffix,
  tone,
  hint,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  tone?: "ok" | "warn" | "danger" | "info" | "accent";
  hint?: string;
  icon?: string;
  trend?: { dir: "up" | "down" | "flat"; value: string };
}) {
  const toneColors: Record<string, string> = { ok: "var(--green)", warn: "var(--yellow)", danger: "var(--red)", info: "var(--blue)", accent: "var(--orange)" };
  const toneColor = (tone && toneColors[tone]) || "var(--text)";
  const toneBgs: Record<string, string> = { ok: "var(--green-15)", warn: "var(--yellow-15)", danger: "var(--red-15)", info: "var(--blue-15)", accent: "var(--orange-15)" };
  const toneBg = (tone && toneBgs[tone]) || "var(--surface-sunken)";
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</span>
        {icon && (
          <span style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", background: toneBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className={`bi ${icon}`} style={{ fontSize: 12.5, color: toneColor }} />
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: tone ? toneColor : "var(--text)" }}>
          {value}
        </span>
        {suffix && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>{suffix}</span>}
        {trend && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              fontWeight: 700,
              color: trend.dir === "up" ? "var(--green)" : trend.dir === "down" ? "var(--red)" : "var(--text-muted)",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <i className={`bi bi-arrow-${trend.dir === "up" ? "up-right" : trend.dir === "down" ? "down-right" : "right"}`} style={{ fontSize: 11 }} />
            {trend.value}
          </span>
        )}
      </div>
      {hint && <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 500 }}>{hint}</span>}
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
export type ToastTone = "success" | "error" | "info";
export function Toast({ message, tone = "info", onClose }: { message: string; tone?: ToastTone; onClose: () => void }) {
  const map = {
    success: { icon: "bi-check-circle-fill", color: "var(--green)", bg: "var(--green-15)", bd: "color-mix(in oklab, var(--green) 35%, transparent)" },
    error: { icon: "bi-x-circle-fill", color: "var(--red)", bg: "var(--red-15)", bd: "color-mix(in oklab, var(--red) 35%, transparent)" },
    info: { icon: "bi-info-circle-fill", color: "var(--blue)", bg: "var(--blue-15)", bd: "color-mix(in oklab, var(--blue) 35%, transparent)" },
  }[tone];
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px",
        background: "var(--surface)",
        border: `1px solid ${map.bd}`,
        borderLeft: `3px solid ${map.color}`,
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-pop)",
        maxWidth: 420,
        animation: "stt-fade-up 0.18s ease-out",
      }}
    >
      <i className={`bi ${map.icon}`} style={{ fontSize: 18, color: map.color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{message}</span>
      <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 2, display: "flex" }}>
        <i className="bi bi-x" style={{ fontSize: 16 }} />
      </button>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function CFModal({
  open,
  onClose,
  title,
  hint,
  icon,
  iconColor,
  footer,
  width = 580,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint?: ReactNode;
  icon?: string;
  iconColor?: string;
  footer?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  // Esc fecha o modal. O hook fica antes do early return para não violar a
  // ordem de hooks quando `open` alterna.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(7, 20, 46, 0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        animation: "stt-fade-in 0.15s ease-out",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--r-card)",
          width: "100%",
          maxWidth: width,
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "var(--shadow-pop)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
          {icon && (
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: "var(--r-md)",
                background: `color-mix(in oklab, ${iconColor ?? "var(--orange)"} 12%, transparent)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <i className={`bi ${icon}`} style={{ fontSize: 18, color: iconColor ?? "var(--orange)" }} />
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", letterSpacing: -0.2 }}>{title}</div>
            {hint && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.45 }}>{hint}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 4, display: "flex", borderRadius: "var(--r-sm)" }}
          >
            <i className="bi bi-x-lg" style={{ fontSize: 16 }} />
          </button>
        </div>
        <div style={{ padding: 22, overflowX: "hidden" }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: "14px 22px",
              borderTop: "1px solid var(--border)",
              background: "var(--surface-2)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              borderRadius: "0 0 var(--r-card) var(--r-card)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Form fields ─────────────────────────────────────────────────────────────
export function CFField({
  label,
  value,
  onChange,
  icon,
  placeholder,
  type = "text",
  hint,
  required,
  disabled,
  step,
  min,
  autoFocus,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  icon?: string;
  placeholder?: string;
  type?: "text" | "date" | "email" | "number" | "password";
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  step?: string | number;
  min?: string | number;
  autoFocus?: boolean;
}) {
  // Data usa o mesmo DatePicker do 7Station/Bem Te Vi (app/components/DatePicker.tsx)
  // — nunca o <input type="date"> nativo do navegador/SO, cujo visual varia
  // entre Windows/Mac/mobile e foge do design do sistema. O DatePicker já é
  // um botão com chrome próprio (borda, ícone, chevron), então aqui é só
  // label + hint por fora, sem a caixa genérica dos outros tipos.
  if (type === "date") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", letterSpacing: 0.2 }}>
          {label}
          {required && <span style={{ color: "var(--orange)" }}> *</span>}
        </span>
        <DatePicker
          full
          value={isoToDate(String(value))}
          onChange={(d) => onChange(dateToIso(d))}
          placeholder={placeholder ?? "Selecionar data"}
          disabled={disabled}
        />
        {hint && <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{hint}</span>}
      </div>
    );
  }

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", letterSpacing: 0.2 }}>
        {label}
        {required && <span style={{ color: "var(--orange)" }}> *</span>}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "var(--field-h)",
          padding: "0 14px",
          gap: 10,
          background: disabled ? "var(--surface-sunken)" : "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--r-md)",
          transition: "border-color 0.12s, box-shadow 0.12s",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--orange)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--orange-15)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {icon && <i className={`bi ${icon}`} style={{ color: "var(--text-faint)", fontSize: 14, flexShrink: 0 }} />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          step={step}
          min={min}
          autoFocus={autoFocus}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text)",
            fontSize: 13.5,
            fontWeight: 500,
            fontFamily: "inherit",
            minWidth: 0,
          }}
        />
      </div>
      {hint && <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{hint}</span>}
    </label>
  );
}

// ─── Campo de valor monetário ────────────────────────────────────────────────
// Máscara "cents-first" (mesmo padrão de app de banco): cada dígito digitado
// entra pela direita, os 2 últimos são sempre os centavos — impossível
// digitar letra (tudo que não é dígito é descartado) e o separador de milhar
// aparece sozinho conforme o número cresce. Pedido do PMO, 2026-09-04: campo
// de "Valor Original do Contrato" aceitava letra e não tinha separador nenhum.
//
// `value`/`onChange` continuam na MESMA convenção já usada em todo o app pra
// campos de valor (string decimal com vírgula, ex. "1234,56", parseada com
// `Number(v.replace(",", "."))`) — só a EXIBIÇÃO ganha o separador de milhar;
// o valor entregue ao `onChange` nunca leva ponto de milhar, então nenhum
// código que já consome esses campos precisa mudar.
function digitosParaValorMoeda(digitos: string): { display: string; clean: string } {
  const soDigitos = digitos.replace(/\D/g, "");
  if (!soDigitos) return { display: "", clean: "" };
  const numero = Number(soDigitos) / 100;
  return {
    display: numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    clean: numero.toFixed(2).replace(".", ","),
  };
}

export function CFCampoMoeda({
  label,
  value,
  onChange,
  icon = "bi-cash-stack",
  hint,
  required,
  disabled,
  autoFocus,
}: {
  label: string;
  /** String decimal com vírgula (ex. "1234,56") ou "" — mesma convenção usada no resto do app. */
  value: string;
  onChange: (v: string) => void;
  icon?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { display } = digitosParaValorMoeda(value);
  return (
    <CFField
      label={label}
      icon={icon}
      value={display}
      onChange={(raw) => onChange(digitosParaValorMoeda(raw).clean)}
      placeholder="0,00"
      hint={hint}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
    />
  );
}

// Dropdown custom via portal — escapa overflow de modais e não trunca opções
// longas como o <select> nativo. Reaproveitado pelo CFSelect.
function SelectDropdown({
  open,
  triggerRef,
  onClose,
  children,
  width,
  align = "left",
  maxHeight = 260,
}: {
  open: boolean;
  triggerRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  children: ReactNode;
  /** Largura fixa em px. Omitido = acompanha a largura do trigger (padrão do CFSelect). */
  width?: number;
  /** Alinhamento horizontal em relação ao trigger. Só faz sentido com `width` fixo. */
  align?: "left" | "right";
  maxHeight?: number;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const popH = popRef.current?.offsetHeight ?? maxHeight;
      const gap = 4;
      const vh = window.innerHeight;
      let top = r.bottom + gap;
      if (top + popH > vh - 8 && r.top - gap - popH > 8) top = r.top - gap - popH;
      const w = width ?? r.width;
      let left = align === "right" ? r.right - w : r.left;
      // Não deixa sair da viewport quando a largura é fixa.
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      setPos({ top, left, width: w });
    }
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, triggerRef, width, align, maxHeight]);

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

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={popRef}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width: pos?.width,
        zIndex: 1000,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-md)",
        padding: 4,
        maxHeight,
        overflowY: "auto",
        visibility: pos ? "visible" : "hidden",
        animation: "stt-fade-in 0.12s ease-out",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

/**
 * Popover em portal — mesma mecânica do dropdown do `CFSelect` (posicionamento
 * fixo, flip vertical quando não cabe embaixo, click-outside e Escape via
 * trigger). Exportado para que outras telas (picker de projeto, menu kebab do
 * apontamento) reaproveitem esse comportamento já testado em vez de recriá-lo.
 */
export const CFPopover = SelectDropdown;

export function CFSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  icon,
  placeholder,
  hint,
  required,
  disabled,
}: {
  label: string;
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  icon?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder ?? "Selecione...";

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", letterSpacing: 0.2 }}>
        {label}
        {required && <span style={{ color: "var(--orange)" }}> *</span>}
      </span>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          height: "var(--field-h)",
          padding: "0 14px",
          gap: 10,
          background: disabled ? "var(--surface-sunken)" : "var(--surface)",
          border: `1.5px solid ${open ? "var(--orange)" : "var(--border)"}`,
          boxShadow: open ? "0 0 0 3px var(--orange-15)" : "none",
          borderRadius: "var(--r-md)",
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          width: "100%",
          transition: "all 0.12s",
        }}
      >
        {icon && <i className={`bi ${icon}`} style={{ color: "var(--text-faint)", fontSize: 14, flexShrink: 0 }} />}
        <span
          style={{
            flex: 1,
            textAlign: "left",
            fontSize: 13.5,
            fontWeight: 500,
            color: selected ? "var(--text)" : "var(--text-faint)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayLabel}
        </span>
        <i className="bi bi-chevron-down" style={{ fontSize: 11, color: "var(--text-faint)", flexShrink: 0 }} />
      </button>

      <SelectDropdown open={open} triggerRef={triggerRef} onClose={() => setOpen(false)}>
        {placeholder && (
          <button
            type="button"
            onClick={() => {
              onChange("" as T);
              setOpen(false);
            }}
            style={optionStyle(value === "")}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-sunken)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = value === "" ? "var(--orange-08)" : "transparent";
            }}
          >
            <span style={{ color: "var(--text-faint)" }}>{placeholder}</span>
          </button>
        )}
        {options.map((o) => {
          const isSel = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={optionStyle(isSel)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-sunken)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = isSel ? "var(--orange-08)" : "transparent";
              }}
            >
              <span style={{ flex: 1 }}>{o.label}</span>
              {isSel && <i className="bi bi-check-lg" style={{ color: "var(--orange)", fontSize: 13, flexShrink: 0 }} />}
            </button>
          );
        })}
      </SelectDropdown>
      {hint && <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{hint}</span>}
    </label>
  );
}

function optionStyle(selected: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    textAlign: "left",
    padding: "8px 10px",
    background: selected ? "var(--orange-08)" : "transparent",
    border: "none",
    borderRadius: "var(--r-sm)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: selected ? 700 : 500,
    color: "var(--text)",
    lineHeight: 1.4,
  };
}

export function CFTextarea({
  label,
  value,
  onChange,
  icon,
  placeholder,
  hint,
  rows = 3,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon?: string;
  placeholder?: string;
  hint?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", letterSpacing: 0.2 }}>
        {label}
        {required && <span style={{ color: "var(--orange)" }}> *</span>}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          padding: "10px 14px",
          gap: 10,
          background: "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--r-md)",
        }}
      >
        {icon && <i className={`bi ${icon}`} style={{ color: "var(--text-faint)", fontSize: 14, marginTop: 4, flexShrink: 0 }} />}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text)",
            fontSize: 13.5,
            fontWeight: 500,
            fontFamily: "inherit",
            resize: "vertical",
            minHeight: 60,
          }}
        />
      </div>
      {hint && <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{hint}</span>}
    </label>
  );
}

// ─── Switch (toggle Sim/Não) ─────────────────────────────────────────────────
// Introduzido pro campo "Faturável" do apontamento (igual Clockify,
// 2026-08-27) — primeiro uso de um toggle no sistema, então fica aqui pra
// qualquer outra tela reaproveitar em vez de reinventar.
export function CFSwitch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: "var(--r-pill)",
          border: "none",
          padding: 2,
          background: checked ? "var(--blue)" : "var(--border-strong)",
          cursor: disabled ? "default" : "pointer",
          transition: "background 0.15s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: "block",
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transform: checked ? "translateX(16px)" : "translateX(0)",
            transition: "transform 0.15s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
          }}
        />
      </button>
      {label && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</span>}
    </label>
  );
}

// ─── Modal alert (inside modal body) ─────────────────────────────────────────
export function CFModalAlert({ tone = "info", icon, children }: { tone?: "info" | "warn" | "ok" | "danger"; icon?: string; children: ReactNode }) {
  const map = {
    info: { bg: "var(--blue-15)", bd: "color-mix(in oklab, var(--blue) 35%, transparent)", fg: "var(--blue)" },
    warn: { bg: "var(--yellow-15)", bd: "color-mix(in oklab, var(--yellow) 35%, transparent)", fg: "var(--yellow)" },
    ok: { bg: "var(--green-15)", bd: "color-mix(in oklab, var(--green) 35%, transparent)", fg: "var(--green)" },
    danger: { bg: "var(--red-15)", bd: "color-mix(in oklab, var(--red) 35%, transparent)", fg: "var(--red)" },
  }[tone];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: "var(--r-sm)",
        background: map.bg,
        border: `1px solid ${map.bd}`,
        fontSize: 12.5,
        color: "var(--text)",
        lineHeight: 1.5,
      }}
    >
      <i className={`bi ${icon || "bi-info-circle-fill"}`} style={{ color: map.fg, fontSize: 14, flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ─── Checklist inline (usado em formulários com pré-requisitos, ex.: TAP) ────
export function CFChecklist({ items }: { items: { ok: boolean; label: string }[] }) {
  return (
    <ul style={{ display: "flex", flexDirection: "column", gap: 4, margin: 0, padding: 0, listStyle: "none" }}>
      {items.map((item) => (
        <li
          key={item.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            fontWeight: 600,
            color: item.ok ? "var(--green)" : "var(--text-faint)",
          }}
        >
          <i className={`bi ${item.ok ? "bi-check-circle-fill" : "bi-circle"}`} style={{ fontSize: 12 }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

// ─── Legenda de classificação ────────────────────────────────────────────────
// Faixa com ícone + rótulo + explicação de cada valor de uma classificação
// (status de projeto, classificação de cliente, etc.) — pro usuário não
// precisar adivinhar o que cada rótulo significa.
export interface CFLegendItem {
  valor: string;
  label: string;
  explicacao: string;
  cor: string;
  icone: string;
}

export function CFLegend({ items }: { items: CFLegendItem[] }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 20px",
        padding: "10px 16px",
        marginBottom: 14,
        background: "var(--surface-sunken)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        fontSize: 12,
      }}
    >
      {items.map((item) => (
        <div key={item.valor} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <i className={`bi ${item.icone}`} style={{ fontSize: 11, color: item.cor, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, color: "var(--text)", flexShrink: 0 }}>{item.label}:</span>
          <span style={{ color: "var(--text-muted)" }}>{item.explicacao}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
export function CFEmptyState({ icon = "bi-inbox", title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "40px 20px", textAlign: "center" }}>
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "var(--surface-sunken)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <i className={`bi ${icon}`} style={{ fontSize: 20, color: "var(--text-faint)" }} />
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-muted)" }}>{title}</span>
      {hint && <span style={{ fontSize: 12, color: "var(--text-faint)", maxWidth: 320 }}>{hint}</span>}
    </div>
  );
}

