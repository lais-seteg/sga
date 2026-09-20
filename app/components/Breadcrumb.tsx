"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";

// Breadcrumb padrão do 7Station, adaptado do React Router (7station-design-system)
// pro Next.js App Router — troca useNavigate/to por useRouter().push/href.
//
// - Itens com `href` ou `onClick` ficam em laranja, clicáveis (parents)
// - Último item (sem href/onClick) fica em var(--text) e fontWeight 600 (current page)
// - Separador é bi-chevron-right pequeno cinza

export type BreadcrumbItem = {
  label: ReactNode;
  icon?: string;
  href?: string;
  onClick?: () => void;
};

export function Breadcrumb({ items, style }: { items: BreadcrumbItem[]; style?: React.CSSProperties }) {
  const router = useRouter();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12.5,
        color: "var(--text-muted)",
        ...style,
      }}
    >
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        const clickable = (!isLast || items.length === 1) && (it.href || it.onClick);
        const handleClick = () => {
          if (it.onClick) it.onClick();
          else if (it.href) router.push(it.href);
        };
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {clickable ? (
              <button
                type="button"
                onClick={handleClick}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--orange)",
                  fontWeight: 600,
                  padding: 0,
                  font: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {it.icon && <i className={`bi ${it.icon}`} style={{ fontSize: 12 }} />}
                {it.label}
              </button>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: isLast ? "var(--text)" : "var(--text-muted)",
                  fontWeight: isLast ? 600 : 500,
                }}
              >
                {it.icon && <i className={`bi ${it.icon}`} style={{ fontSize: 12 }} />}
                {it.label}
              </span>
            )}
            {!isLast && <i className="bi bi-chevron-right" style={{ fontSize: 9, color: "var(--text-faint)" }} />}
          </span>
        );
      })}
    </div>
  );
}
