"use client";

// Indicadores de produção das peças gráficas.
//
// Os seis números pedidos pelo PMO, e um princípio ao lado de cada um: toda
// métrica de tempo aparece com MEDIANA e média. Tempo de atendimento tem
// cauda longa — um pedido que ficou dois meses parado puxa a média e faz o
// painel descrever o outlier em vez da rotina. A mediana responde "como é um
// pedido típico"; a média, "qual o custo total".

import { useRouter, useSearchParams } from "next/navigation";
import { CFAlert, CFPageHeader, Card } from "@/app/components/ui-kit";
import {
  formatarDuracao,
  formatarPercentual,
  type Indicadores,
  type Resumo,
} from "@/lib/indicadores";

export interface LinhaSetor {
  setor: string;
  total: number;
  finalizadas: number;
  noPrazo: number;
  avaliadas: number;
  retrabalhos: number;
  prazoTotalSoma: number;
}

const PERIODO_LABEL: Record<string, string> = {
  "30": "Últimos 30 dias",
  "90": "Últimos 90 dias",
  "365": "Últimos 12 meses",
  tudo: "Todo o histórico",
};

export default function DashboardClient({
  indicadores: i,
  setores,
  periodo,
}: {
  indicadores: Indicadores;
  setores: LinhaSetor[];
  periodo: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function trocarPeriodo(novo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("periodo", novo);
    router.push(`/dashboard?${params.toString()}`);
  }

  const semDados = i.total === 0;

  return (
    <div>
      <CFPageHeader
        title="Indicadores de Produção"
        subtitle="Quanto tempo uma peça leva em cada etapa, quanto volta para ajuste e quanto sai no prazo."
        actions={
          <div style={{ display: "flex", gap: 6 }}>
            {Object.entries(PERIODO_LABEL).map(([valor, label]) => (
              <button
                key={valor}
                type="button"
                onClick={() => trocarPeriodo(valor)}
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: "var(--r-pill)",
                  border: `1px solid ${periodo === valor ? "var(--orange)" : "var(--border)"}`,
                  background: periodo === valor ? "var(--orange-15)" : "var(--surface)",
                  color: periodo === valor ? "var(--orange)" : "var(--text-muted)",
                  fontFamily: "inherit",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {semDados ? (
        <Card>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>
            Nenhuma solicitação neste período. Experimente ampliar a janela de tempo.
          </p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* A ressalva vem ANTES dos números, não num rodapé: quem lê um
              indicador precisa saber sobre quantos casos ele fala. */}
          {i.aproximadas > 0 && (
            <CFAlert tone="info" icon="bi-info-circle-fill" title="Cobertura dos indicadores">
              <strong>{i.aproximadas}</strong> {i.aproximadas === 1 ? "solicitação é anterior" : "solicitações são anteriores"}{" "}
              ao registro de etapas e {i.aproximadas === 1 ? "tem" : "têm"} só a data de abertura e a
              de conclusão. {i.aproximadas === 1 ? "Ela entra" : "Elas entram"} em prazo total e
              cumprimento de prazo, mas {i.aproximadas === 1 ? "fica" : "ficam"} de fora dos tempos
              por etapa e do retrabalho — a trilha reconstruída só conhece o começo e o fim, então
              não há como saber quando a peça entrou em produção nem quantas vezes voltou para
              ajuste. Estimar isso seria inventar número.{" "}
              <strong>
                Tempos por etapa e retrabalho consideram {i.comHistoricoReal}{" "}
                {i.comHistoricoReal === 1 ? "solicitação" : "solicitações"}.
              </strong>
            </CFAlert>
          )}

          {/* ─── Os seis indicadores ─── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 12,
            }}
          >
            <CartaoTempo
              titulo="Prazo total da demanda"
              descricao="Da abertura à entrega final"
              resumo={i.prazoTotal}
              icone="bi-calendar-range"
              tom="var(--navy)"
            />
            <CartaoTempo
              titulo="Tempo de elaboração"
              descricao="Em produção pela equipe"
              resumo={i.elaboracao}
              icone="bi-pencil-fill"
              tom="var(--orange)"
            />
            <CartaoTempo
              titulo="Aguardando o solicitante"
              descricao="Entregue, esperando retorno"
              resumo={i.aguardandoSolicitante}
              icone="bi-hourglass-split"
              tom="var(--text-muted)"
            />
            <CartaoTempo
              titulo="Aprovação → finalização"
              descricao="Do aceite ao fechamento"
              resumo={i.aprovacaoAteFinalizacao}
              icone="bi-hand-thumbs-up"
              tom="var(--green)"
            />

            <CartaoNumero
              titulo="Retrabalho"
              icone="bi-arrow-counterclockwise"
              tom="var(--blue)"
              valor={formatarPercentual(i.retrabalho.percentual)}
              sufixo="das peças"
              linhas={[
                [`${i.retrabalho.comRetrabalho} de ${i.retrabalho.base}`, "voltaram ao menos uma vez"],
                [`${i.retrabalho.total}`, "voltas no total"],
                [
                  i.retrabalho.mediaPorSolicitacao !== null
                    ? i.retrabalho.mediaPorSolicitacao.toFixed(2).replace(".", ",")
                    : "—",
                  "voltas por peça",
                ],
              ]}
            />

            <CartaoNumero
              titulo="Cumprimento de prazo"
              icone="bi-check2-square"
              tom={
                (i.prazos.percentualNoPrazoLimite ?? 100) >= 90
                  ? "var(--green)"
                  : (i.prazos.percentualNoPrazoLimite ?? 100) >= 70
                    ? "var(--yellow)"
                    : "var(--red)"
              }
              valor={formatarPercentual(i.prazos.percentualNoPrazoLimite)}
              sufixo="no prazo limite"
              linhas={[
                [`${i.prazos.noPrazoLimite} de ${i.prazos.avaliadas}`, "entregues no prazo"],
                [formatarPercentual(i.prazos.percentualNoPrazoIdeal), "na data ideal"],
                [
                  i.prazos.atrasoMedioEmDias !== null
                    ? formatarDuracao(i.prazos.atrasoMedioEmDias)
                    : "—",
                  "de atraso médio, quando atrasa",
                ],
              ]}
            />
          </div>

          {/* ─── Onde o tempo é gasto ─── */}
          <Card>
            <Titulo
              texto="Onde o tempo é gasto"
              hint={`Composição do tempo médio de uma peça, em dias — base: ${i.comHistoricoReal} ${i.comHistoricoReal === 1 ? "solicitação" : "solicitações"} com histórico de etapas`}
            />
            {i.composicao.length === 0 ? (
              <VazioEtapas />
            ) : (
              <BarraComposicao
                segmentos={i.composicao.map((c) => ({
                  label: c.label,
                  valor: c.dias,
                  cor: c.cor,
                }))}
              />
            )}
          </Card>

          {/* ─── Cumprimento de prazo, em detalhe ─── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            <Card>
              <Titulo
                texto="Entregas no prazo"
                hint={`${i.prazos.avaliadas} ${i.prazos.avaliadas === 1 ? "peça finalizada" : "peças finalizadas"} no período`}
              />
              {i.prazos.avaliadas === 0 ? (
                <Vazio texto="Nenhuma peça finalizada neste período." />
              ) : (
                <BarraComposicao
                  segmentos={[
                    { label: "No prazo limite", valor: i.prazos.noPrazoLimite, cor: "var(--green)" },
                    { label: "Atrasadas", valor: i.prazos.atrasadas, cor: "var(--red)" },
                  ]}
                  formatar={(v) => `${v}`}
                />
              )}
            </Card>

            <Card>
              <Titulo
                texto="Andamento da fila"
                hint={`${i.total} ${i.total === 1 ? "solicitação" : "solicitações"} no período`}
              />
              <BarraComposicao
                segmentos={[
                  { label: "Finalizadas", valor: i.finalizadas, cor: "var(--green)" },
                  { label: "Em aberto", valor: i.emAberto, cor: "var(--orange)" },
                ]}
                formatar={(v) => `${v}`}
              />
            </Card>
          </div>

          {/* ─── Por setor ─── */}
          <Card padding={false}>
            <div style={{ padding: "18px 22px 0" }}>
              <Titulo texto="Por setor solicitante" hint="De onde vem a demanda e onde o prazo aperta" />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={TH}>Setor</th>
                    <th style={{ ...TH, textAlign: "right" }}>Pedidos</th>
                    <th style={{ ...TH, textAlign: "right" }}>Finalizados</th>
                    <th style={{ ...TH, textAlign: "right" }}>Prazo médio</th>
                    <th style={{ ...TH, textAlign: "right" }}>No prazo</th>
                    <th style={{ ...TH, textAlign: "right" }}>Retrabalhos</th>
                  </tr>
                </thead>
                <tbody>
                  {setores.map((s) => {
                    const prazoMedio = s.finalizadas > 0 ? s.prazoTotalSoma / s.finalizadas : null;
                    const pctPrazo = s.avaliadas > 0 ? (s.noPrazo / s.avaliadas) * 100 : null;
                    return (
                      <tr key={s.setor}>
                        <td style={{ ...TD, fontWeight: 600 }}>{s.setor}</td>
                        <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.total}</td>
                        <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.finalizadas}</td>
                        <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {formatarDuracao(prazoMedio)}
                        </td>
                        <td
                          style={{
                            ...TD,
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color:
                              pctPrazo === null
                                ? "var(--text-faint)"
                                : pctPrazo >= 90
                                  ? "var(--green)"
                                  : pctPrazo >= 70
                                    ? "var(--yellow)"
                                    : "var(--red)",
                            fontWeight: 700,
                          }}
                        >
                          {formatarPercentual(pctPrazo)}
                        </td>
                        <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.retrabalhos}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 22px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "var(--text-faint)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "12px 22px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
  fontSize: 13.5,
};

function Titulo({ texto, hint }: { texto: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{texto}</div>
      {hint && (
        <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>{hint}</div>
      )}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p style={{ margin: 0, fontSize: 13, color: "var(--text-faint)" }}>{texto}</p>;
}

function VazioEtapas() {
  return (
    <p style={{ margin: 0, fontSize: 13, color: "var(--text-faint)", lineHeight: 1.6 }}>
      Ainda não há solicitação com histórico de etapas neste período. Os tempos por etapa começam a
      aparecer conforme os pedidos novos avançam pelo fluxo.
    </p>
  );
}

/**
 * Cartão de um indicador de tempo.
 *
 * A MEDIANA vem em destaque e a média em letra miúda, de propósito: é a
 * mediana que descreve o pedido típico. Mostrar só a média faria um único
 * caso extremo definir o número que a equipe olha toda semana.
 */
function CartaoTempo({
  titulo,
  descricao,
  resumo,
  icone,
  tom,
}: {
  titulo: string;
  descricao: string;
  resumo: Resumo;
  icone: string;
  tom: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card)",
        padding: "16px 18px",
        boxShadow: "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: "var(--text-muted)",
            letterSpacing: 0.3,
            textTransform: "uppercase",
          }}
        >
          {titulo}
        </span>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "var(--r-sm)",
            background: `color-mix(in oklab, ${tom} 12%, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <i className={`bi ${icone}`} style={{ fontSize: 12.5, color: tom }} />
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: -0.5,
            lineHeight: 1,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatarDuracao(resumo.mediana)}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>mediana</span>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--text-faint)", lineHeight: 1.5 }}>
        {descricao}
        <br />
        média {formatarDuracao(resumo.media)} · {resumo.amostra}{" "}
        {resumo.amostra === 1 ? "peça" : "peças"}
      </div>
    </div>
  );
}

function CartaoNumero({
  titulo,
  icone,
  tom,
  valor,
  sufixo,
  linhas,
}: {
  titulo: string;
  icone: string;
  tom: string;
  valor: string;
  sufixo: string;
  linhas: [string, string][];
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card)",
        padding: "16px 18px",
        boxShadow: "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: "var(--text-muted)",
            letterSpacing: 0.3,
            textTransform: "uppercase",
          }}
        >
          {titulo}
        </span>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "var(--r-sm)",
            background: `color-mix(in oklab, ${tom} 12%, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <i className={`bi ${icone}`} style={{ fontSize: 12.5, color: tom }} />
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: -0.5,
            lineHeight: 1,
            color: tom,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {valor}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{sufixo}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {linhas.map(([n, texto]) => (
          <div key={texto} style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
            <strong style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{n}</strong>{" "}
            {texto}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Barra empilhada de composição, com legenda embaixo.
 *
 * Cada fatia leva o valor por escrito na legenda: uma barra sozinha mostra
 * proporção, mas ninguém consegue ler "2,3 dias" de um retângulo. Fatias
 * menores que 4% do total não recebem rótulo dentro da barra, onde o texto
 * não caberia — o número continua na legenda.
 */
function BarraComposicao({
  segmentos,
  formatar = formatarDuracao,
}: {
  segmentos: { label: string; valor: number; cor: string }[];
  formatar?: (v: number) => string;
}) {
  const total = segmentos.reduce((t, s) => t + s.valor, 0);
  if (total <= 0) return <Vazio texto="Sem dados suficientes." />;

  return (
    <div>
      <div
        style={{
          display: "flex",
          height: 30,
          borderRadius: "var(--r-sm)",
          overflow: "hidden",
          background: "var(--surface-sunken)",
        }}
      >
        {segmentos
          .filter((s) => s.valor > 0)
          .map((s) => {
            const pct = (s.valor / total) * 100;
            return (
              <div
                key={s.label}
                title={`${s.label}: ${formatar(s.valor)} (${pct.toFixed(0)}%)`}
                style={{
                  width: `${pct}%`,
                  background: s.cor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                {pct >= 12 ? `${pct.toFixed(0)}%` : ""}
              </div>
            );
          })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", marginTop: 12 }}>
        {segmentos
          .filter((s) => s.valor > 0)
          .map((s) => (
            <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: s.cor,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {s.label}{" "}
                <strong style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                  {formatar(s.valor)}
                </strong>
              </span>
            </span>
          ))}
      </div>
    </div>
  );
}
