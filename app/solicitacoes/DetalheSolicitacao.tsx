"use client";

// Conteúdo do modal de detalhes — as mesmas 11 seções do formulário, em
// ordem, para quem lê a solicitação encontrar cada coisa onde ela foi
// preenchida.

import { StatusSolicitacao } from "@prisma/client";
import { CFStatusBadge } from "@/app/components/ui-kit";
import { formatDate } from "@/app/components/ui-helpers";
import { STATUS_INFO } from "@/lib/statusSolicitacao";
import { iconeFormato, rotuloFormato, rotuloTipoMaterial } from "@/lib/solicitacaoListas";
import { formatarDuracao } from "@/lib/indicadores";
import { EtapaSolicitacao, SolicitacaoLinha } from "./tipos";

export default function DetalheSolicitacao({ solicitacao: s }: { solicitacao: SolicitacaoLinha }) {
  // A última volta para ajuste. "Última" porque uma peça pode ir e voltar
  // várias vezes, e o que interessa em destaque é o pedido em aberto — as
  // rodadas anteriores continuam na linha do tempo.
  const ajustePendente = [...s.etapas]
    .reverse()
    .find((e) => e.status === StatusSolicitacao.ajustes && e.observacao);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Resumo: o que se quer saber sem rolar a página. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 14,
          padding: 16,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
        }}
      >
        <Resumo rotulo="Protocolo">
          <strong style={{ fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{s.protocolo}</strong>
        </Resumo>
        <Resumo rotulo="Status">
          <CFStatusBadge kind={STATUS_INFO[s.status].kind} label={STATUS_INFO[s.status].label} />
        </Resumo>
        <Resumo rotulo="Aberta em">{formatarDataHora(s.criadoEm)}</Resumo>
        <Resumo rotulo="Finalizada em">
          {s.concluidoEm ? (
            <>
              {formatarDataHora(s.concluidoEm)}
              {/* Quem finalizou vem logo abaixo da data, e não escondido na
                  linha do tempo: "quando ficou pronta" e "quem fechou" são a
                  mesma pergunta para quem cobra uma entrega. */}
              <span
                style={{
                  display: "block",
                  fontSize: 11.5,
                  color: s.concluidoPor ? "var(--text-muted)" : "var(--text-faint)",
                  fontStyle: s.concluidoPor ? "normal" : "italic",
                  marginTop: 2,
                }}
              >
                {s.concluidoPor ? (
                  <>
                    <i className="bi bi-person-check" style={{ fontSize: 10.5, marginRight: 4 }} />
                    por {s.concluidoPor}
                  </>
                ) : (
                  "autor não registrado"
                )}
              </span>
            </>
          ) : (
            <span style={{ color: "var(--text-faint)" }}>Ainda em andamento</span>
          )}
        </Resumo>
        <Resumo rotulo={s.emAberto ? "Tempo decorrido" : "Tempo total"}>
          <strong style={{ color: s.emAberto ? "var(--text)" : "var(--green)" }}>
            {formatarDuracao(s.tempoDias)}
          </strong>
        </Resumo>
        <Resumo rotulo="Solicitante">{s.solicitanteNome}</Resumo>
      </div>

      {/* Peça parada em Ajuste Pendente: o que foi pedido é a informação mais
          acionável do modal, e não deveria exigir rolar até a linha do tempo.
          Some assim que a peça sai desse estado — aí vira histórico. */}
      {s.status === StatusSolicitacao.ajustes && ajustePendente && (
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: 14,
            background: "var(--blue-15)",
            border: "1px solid color-mix(in oklab, var(--blue) 35%, transparent)",
            borderRadius: "var(--r-md)",
          }}
        >
          <i
            className="bi bi-arrow-counterclockwise"
            style={{ color: "var(--blue)", fontSize: 16, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--blue)", marginBottom: 3 }}>
              AJUSTES PEDIDOS
              {ajustePendente.por && (
                <span style={{ fontWeight: 600, opacity: 0.85 }}> · {ajustePendente.por}</span>
              )}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text)",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {ajustePendente.observacao}
            </div>
          </div>
        </div>
      )}

      <LinhaDoTempo etapas={s.etapas} />

      {s.urgente && (
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: 14,
            background: "var(--red-15)",
            border: "1px solid color-mix(in oklab, var(--red) 35%, transparent)",
            borderRadius: "var(--r-md)",
          }}
        >
          <i className="bi bi-exclamation-triangle-fill" style={{ color: "var(--red)", fontSize: 16, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--red)", marginBottom: 3 }}>
              PEDIDO URGENTE
            </div>
            <div style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {s.urgenciaJustificativa}
            </div>
          </div>
        </div>
      )}

      <Secao icone="bi-person" titulo="1. Solicitante">
        <Grade>
          <Campo rotulo="Nome" valor={s.solicitanteNome} />
          <Campo
            rotulo="E-mail"
            // Registro anterior ao login: não havia conta, então não há
            // e-mail para mostrar. Dizer isso é melhor do que "Não informado",
            // que sugeriria um campo deixado em branco por descuido.
            valor={s.historico ? "Pedido anterior ao login por e-mail" : s.solicitanteEmail}
          />
          <Campo rotulo="Setor / área" valor={s.solicitanteSetor} />
          <Campo rotulo="Projeto / cliente" valor={s.solicitanteCliente} />
        </Grade>
      </Secao>

      <Secao icone="bi-calendar3" titulo="2. Prazo">
        <Grade>
          <Campo rotulo="Data ideal de entrega" valor={formatDate(s.prazoIdeal)} />
          <Campo rotulo="Data limite" valor={formatDate(s.prazoLimite)} />
        </Grade>
      </Secao>

      <Secao icone="bi-bounding-box" titulo="3. Tipo de material">
        <Campo rotulo="Tipo" valor={rotuloTipoMaterial(s.tipoMaterial, s.tipoMaterialOutro)} />
      </Secao>

      <Secao icone="bi-bullseye" titulo="4. Objetivo">
        <Bloco texto={s.objetivo} />
      </Secao>

      <Secao icone="bi-file-text" titulo="5. Conteúdo">
        <Bloco texto={s.conteudo} />
      </Secao>

      <Secao icone="bi-exclamation-circle" titulo="6. Informações obrigatórias">
        <Bloco texto={s.infoObrigatorias} />
      </Secao>

      <Secao icone="bi-aspect-ratio" titulo="7. Formato">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {s.formatos.map((f) => (
            <span
              key={f}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: "var(--r-pill)",
                background: "var(--surface-sunken)",
                color: "var(--text-muted)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <i className={`bi ${iconeFormato(f)}`} style={{ fontSize: 11 }} />
              {f === "outros" && s.formatoOutros ? s.formatoOutros : rotuloFormato(f)}
            </span>
          ))}
        </div>
        <Grade>
          <Campo rotulo="Dimensões" valor={s.dimensoes} />
          <Campo rotulo="Páginas" valor={s.paginas !== null ? String(s.paginas) : null} />
        </Grade>
      </Secao>

      <Secao icone="bi-palette" titulo="8. Identidade visual">
        <Campo
          rotulo="Possui identidade visual"
          valor={s.identidadeVisual ? "Sim" : "Não"}
        />
        {s.identidadeVisual && <Campo rotulo="Diretório / link" valor={s.identidadeDiretorio} />}
      </Secao>

      <Secao icone="bi-images" titulo="9. Referências">
        <Campo rotulo="Diretório" valor={s.referenciasDiretorio} />
      </Secao>

      <Secao icone="bi-folder2-open" titulo="10. Materiais">
        <Campo rotulo="Diretório" valor={s.materiaisDiretorio} />
      </Secao>

      <Secao icone="bi-sticky" titulo="11. Observações">
        <Bloco texto={s.observacoes} />
      </Secao>
    </div>
  );
}

/**
 * A trilha de mudanças de status, com quanto tempo a peça ficou em cada uma.
 *
 * É o "de onde veio esse número" do tempo total: em vez de um único valor
 * agregado, mostra onde ele foi gasto. Quando uma peça demora, a pergunta
 * seguinte é sempre "demorou onde?" — e a resposta costuma ser uma etapa só.
 *
 * A duração aparece à direita de cada etapa, e não embaixo, para as linhas
 * ficarem comparáveis de relance.
 */
function LinhaDoTempo({ etapas }: { etapas: EtapaSolicitacao[] }) {
  if (etapas.length === 0) return null;

  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 14px",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <i className="bi bi-clock-history" style={{ fontSize: 13, color: "var(--orange)" }} />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text)" }}>
          Andamento
        </span>
      </header>

      <div style={{ padding: "14px 16px" }}>
        {etapas.map((e, indice) => {
          const ultima = indice === etapas.length - 1;
          const info = STATUS_INFO[e.status];
          return (
            <div key={`${e.em}-${indice}`} style={{ display: "flex", gap: 12 }}>
              {/* Marcador e fio: o fio some na última etapa, senão pareceria
                  que existe um passo seguinte que ainda não carregou. */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "var(--surface-sunken)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i className={`bi ${info.icon}`} style={{ fontSize: 10.5, color: "var(--text-muted)" }} />
                </span>
                {!ultima && <span style={{ width: 2, flex: 1, minHeight: 14, background: "var(--border)" }} />}
              </div>

              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingBottom: ultima ? 0 : 14,
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{info.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                    {formatarDataHora(e.em)}
                    {e.aproximada && (
                      <span title="Data reconstruída do histórico anterior ao registro de etapas">
                        {" "}· data aproximada
                      </span>
                    )}
                  </div>
                  {/* O autor ganha linha própria, com ícone. Antes vinha
                      colado na data por um "·", e a pergunta "quem fez isso?"
                      — que é a razão de existir um histórico — ficava com o
                      mesmo peso visual do minuto em que aconteceu. */}
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: e.por ? 600 : 400,
                      color: e.por ? "var(--text-muted)" : "var(--text-faint)",
                      fontStyle: e.por ? "normal" : "italic",
                      marginTop: 1,
                    }}
                  >
                    <i
                      className={`bi ${e.por ? "bi-person-fill" : "bi-person-dash"}`}
                      style={{ fontSize: 10.5, marginRight: 4 }}
                    />
                    {e.por ?? "autor não registrado"}
                  </div>

                  {/* O que foi pedido nesta volta. Fica dentro da etapa, e não
                      num campo único da solicitação, porque cada rodada de
                      ajuste tem o seu texto — é o que explica por que a peça
                      voltou duas vezes, e o que a equipe lê para refazer. */}
                  {e.observacao && (
                    <div
                      style={{
                        marginTop: 7,
                        padding: "9px 12px",
                        background: "var(--blue-15)",
                        borderLeft: "3px solid var(--blue)",
                        borderRadius: "var(--r-sm)",
                        fontSize: 12.5,
                        color: "var(--text)",
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {e.observacao}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {/* A última etapa de uma peça JÁ ENTREGUE não tem duração:
                      não é um estágio em que ela "ficou", é o ponto de
                      chegada. Mas se houver um passo depois (pedido reaberto),
                      a duração volta a significar algo e aparece. */}
                  {ultima && e.status === StatusSolicitacao.concluido
                    ? ""
                    : formatarDuracao(e.duracaoDias)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Data e hora curtas: "19/09/2026, 14:32". A HORA importa aqui — várias
 *  mudanças de status acontecem no mesmo dia, e sem ela a trilha pareceria
 *  uma pilha de eventos simultâneos. */
function formatarDataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function Resumo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: "var(--text-faint)",
        }}
      >
        {rotulo}
      </span>
      <span style={{ fontSize: 13.5, color: "var(--text)", overflowWrap: "anywhere" }}>{children}</span>
    </div>
  );
}

function Secao({ icone, titulo, children }: { icone: string; titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 14px",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <i className={`bi ${icone}`} style={{ fontSize: 13, color: "var(--orange)" }} />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text)" }}>{titulo}</span>
      </header>
      <div style={{ padding: 14 }}>{children}</div>
    </section>
  );
}

function Grade({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
      {children}
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)" }}>{rotulo}</span>
      {valor ? (
        <span style={{ fontSize: 13, color: "var(--text)", overflowWrap: "anywhere" }}>{valor}</span>
      ) : (
        <span style={{ fontSize: 13, color: "var(--text-faint)", fontStyle: "italic" }}>Não informado</span>
      )}
    </div>
  );
}

function Bloco({ texto }: { texto: string | null }) {
  if (!texto) {
    return <span style={{ fontSize: 13, color: "var(--text-faint)", fontStyle: "italic" }}>Não informado</span>;
  }
  return (
    <p
      style={{
        margin: 0,
        padding: 12,
        background: "var(--surface-2)",
        borderRadius: "var(--r-sm)",
        fontSize: 13,
        lineHeight: 1.6,
        color: "var(--text)",
        // `pre-wrap` preserva as quebras de linha que a pessoa digitou (o
        // conteúdo da peça costuma vir colado de um documento), e
        // `anywhere` impede que um link longo estoure a largura do modal.
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      {texto}
    </p>
  );
}
