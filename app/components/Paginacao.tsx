"use client";

// Rodapé de paginação de tabela — usado pela lista de solicitações e pela
// Gestão de Acessos.
//
// Vive aqui, e não dentro de uma das telas, porque as duas precisam se
// comportar igual: mesma contagem "1–10 de 137", mesmos controles, mesmo
// seletor de itens por página. Duas cópias divergem na primeira vez que
// alguém ajusta uma delas.
//
// O rodapé é SEMPRE renderizado, mesmo com uma única linha ou nenhuma. Some
// quando a lista é curta, a tabela perdia a base e ficava boiando num vazio;
// e quem tem um pedido só nunca saberia que existe paginação. Os controles
// ficam desabilitados quando não há para onde navegar.

export const ITENS_POR_PAGINA_PADRAO = 10;
const OPCOES_POR_PAGINA = [10, 20, 50];

export default function Paginacao({
  total,
  inicio,
  quantidade,
  pagina,
  totalPaginas,
  porPagina,
  onPagina,
  onPorPagina,
}: {
  /** Total de itens depois dos filtros. */
  total: number;
  /** Índice (base zero) do primeiro item mostrado. */
  inicio: number;
  /** Quantos itens a página atual mostra. */
  quantidade: number;
  pagina: number;
  totalPaginas: number;
  porPagina: number;
  onPagina: (n: number) => void;
  onPorPagina: (n: number) => void;
}) {
  const btn = (icone: string, alvo: number, rotulo: string, desabilitado: boolean) => (
    <button
      type="button"
      onClick={() => onPagina(alvo)}
      disabled={desabilitado}
      aria-label={rotulo}
      title={rotulo}
      style={{
        width: 30,
        height: 30,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--r-sm)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: desabilitado ? "var(--text-faint)" : "var(--text-muted)",
        cursor: desabilitado ? "default" : "pointer",
        opacity: desabilitado ? 0.5 : 1,
      }}
    >
      <i className={`bi ${icone}`} style={{ fontSize: 12 }} />
    </button>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: "wrap",
        padding: "12px 18px",
        borderTop: "1px solid var(--border)",
        background: "var(--surface-2)",
      }}
    >
      <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
        {/* Com a lista vazia, "1–0 de 0" seria absurdo. */}
        {total === 0 ? "Nenhum registro" : `${inicio + 1}–${inicio + quantidade} de ${total}`}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {btn("bi-chevron-double-left", 1, "Primeira página", pagina === 1)}
        {btn("bi-chevron-left", pagina - 1, "Página anterior", pagina === 1)}
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--text)",
            padding: "0 8px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {pagina} / {totalPaginas}
        </span>
        {btn("bi-chevron-right", pagina + 1, "Próxima página", pagina === totalPaginas)}
        {btn("bi-chevron-double-right", totalPaginas, "Última página", pagina === totalPaginas)}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
        Por página
        <select
          className="pmo-select"
          value={porPagina}
          onChange={(e) => onPorPagina(Number(e.target.value))}
          style={{ height: 30, fontSize: 12.5 }}
        >
          {OPCOES_POR_PAGINA.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
