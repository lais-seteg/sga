// Helpers puros (sem hooks, sem "use client") — separados de ui-kit.tsx
// porque funções exportadas por um módulo "use client" viram referências de
// cliente quando importadas por Server Components, e deixam de ser
// chamáveis durante a renderização no servidor ("X is not a function").

export function initialsFromName(name: string | undefined | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Cor estável a partir do id/nome — para avatares
export function colorFromString(s: string): string {
  const palette = ["#7e57c2", "#2f9e6e", "#3f6fd9", "#d8553a", "#1565c0", "#c2a82a", "#5a55c9", "#ff8200", "#0aa6b4", "#cf4f7e"];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(h) % palette.length];
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
