"use client";

// Tela principal do SGA: KPIs, filtros, tabela paginada e as ações de fila.
// É a herdeira direta do antigo src/app.js — mesma informação, mesmos
// filtros, mesma paginação — mas sem manipular DOM na mão: o estado vive no
// React e a tabela é só uma função dele.

import { forwardRef, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusSolicitacao } from "@prisma/client";
import {
  Btn,
  CFAlert,
  CFEmptyState,
  CFModal,
  CFPageHeader,
  CFPopover,
  CFStatusBadge,
  CFTextarea,
  Toast,
  ToastTone,
} from "@/app/components/ui-kit";
import { formatDate } from "@/app/components/ui-helpers";
import {
  podeCancelar,
  PROXIMO_STATUS,
  SAIDAS_APROVACAO,
  STATUS_INFO,
  STATUS_ORDEM,
} from "@/lib/statusSolicitacao";
import { iconeFormato, rotuloFormato, rotuloTipoMaterial, SETORES } from "@/lib/solicitacaoListas";
import type { ProjetoOpcao } from "@/lib/projetos";
import { formatarDuracao } from "@/lib/indicadores";
import Paginacao, { ITENS_POR_PAGINA_PADRAO } from "@/app/components/Paginacao";
import { SolicitacaoLinha } from "./tipos";
import NovaSolicitacaoModal from "./NovaSolicitacaoModal";
import DetalheSolicitacao from "./DetalheSolicitacao";

// Cabecalho e conteudo centralizados, por pedido da Seteg.
const TH: React.CSSProperties = {
  textAlign: "center",
  padding: "12px 18px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "var(--text-faint)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  background: "var(--surface)",
  zIndex: 1,
};

const TD: React.CSSProperties = {
  padding: "var(--row-py, 12px) 18px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
  fontSize: 13.5,
  textAlign: "center",
};

/** Cor de cada KPI, no mesmo semáforo dos selos de status: amarelo enquanto
 *  espera, laranja em produção, cinza com o solicitante, azul em retrabalho,
 *  verde no fim. */
const TOM_KPI: Record<StatusSolicitacao, "ok" | "warn" | "danger" | "info" | "accent" | undefined> = {
  [StatusSolicitacao.na_fila]: "warn",
  [StatusSolicitacao.em_andamento]: "accent",
  [StatusSolicitacao.aguardando_aprovacao]: undefined,
  [StatusSolicitacao.ajustes]: "info",
  [StatusSolicitacao.aprovado]: "ok",
  [StatusSolicitacao.concluido]: "ok",
  [StatusSolicitacao.cancelado]: "danger",
};

/** As três respostas que o solicitante pode dar sobre a própria peça. */
type AcaoResposta = "aprovar" | "ajustar" | "cancelar";

/**
 * Os textos de cada resposta, num lugar só.
 *
 * Duas delas pedem justificativa por escrito: "ajustar" porque a equipe
 * precisa saber o que refazer, e "cancelar" porque um pedido que some da
 * fila sem motivo registrado vira discussão depois.
 */
const TEXTO_ACAO: Record<
  AcaoResposta,
  {
    titulo: string;
    icone: string;
    cor: string;
    botao: string;
    exigeTexto: boolean;
    rotuloCampo?: string;
    placeholder?: string;
    dica?: string;
    erro: string;
  }
> = {
  aprovar: {
    titulo: "Aprovar e finalizar",
    icone: "bi-check2-circle",
    cor: "var(--green)",
    botao: "Aprovar e finalizar",
    exigeTexto: false,
    erro: "",
  },
  ajustar: {
    titulo: "Solicitar ajustes",
    icone: "bi-arrow-counterclockwise",
    cor: "var(--blue)",
    botao: "Solicitar ajustes",
    exigeTexto: true,
    rotuloCampo: "Quais ajustes são necessários?",
    placeholder:
      "Ex.: trocar a cor do fundo para o azul da marca, corrigir a data para 15/10 e aumentar a logo.",
    dica: "Quanto mais específico, menos idas e vindas — este texto é o que a equipe vai ler para saber o que refazer.",
    erro: "Descreva quais ajustes são necessários.",
  },
  cancelar: {
    titulo: "Cancelar solicitação",
    icone: "bi-x-circle",
    cor: "var(--red)",
    botao: "Cancelar solicitação",
    exigeTexto: true,
    rotuloCampo: "Por que está cancelando?",
    placeholder: "Ex.: o evento foi adiado sem nova data, a peça não será mais usada.",
    dica: "O pedido continua na lista, com status Cancelado — cancelar não apaga o histórico.",
    erro: "Explique o motivo do cancelamento.",
  },
};

/** Tira acento e caixa para a busca casar "Inovacao" com "Inovação". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function SolicitacoesClient({
  solicitacoes,
  ehAdmin,
  setorPadrao,
  projetos,
}: {
  solicitacoes: SolicitacaoLinha[];
  ehAdmin: boolean;
  setorPadrao: string;
  projetos: ProjetoOpcao[];
}) {
  const router = useRouter();

  const [filtroStatus, setFiltroStatus] = useState<StatusSolicitacao | "todos">("todos");
  const [filtroSetor, setFiltroSetor] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(ITENS_POR_PAGINA_PADRAO);

  const [novaAberta, setNovaAberta] = useState(false);
  const [detalhe, setDetalhe] = useState<SolicitacaoLinha | null>(null);
  const [excluindo, setExcluindo] = useState<SolicitacaoLinha | null>(null);
  /** Resposta do solicitante à aprovação, aguardando confirmação. Aprovar
   *  encerra o pedido e pedir ajuste devolve trabalho para a equipe — os dois
   *  merecem um passo a mais que um clique solto na tabela. */
  const [respondendo, setRespondendo] = useState<
    { solicitacao: SolicitacaoLinha; acao: AcaoResposta } | null
  >(null);
  /** Justificativa do ajuste ou do cancelamento. Obrigatória nos dois — ver a
   *  validação no servidor. */
  const [textoAjuste, setTextoAjuste] = useState("");
  const [erroAjuste, setErroAjuste] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);

  // Os contadores olham SEMPRE a lista completa que a pessoa pode ver, nunca
  // a lista filtrada: um KPI que muda quando se clica num filtro deixa de
  // ser um indicador e vira um eco do filtro.
  const metricas = useMemo(() => {
    // Contagem por estado, montada a partir de STATUS_ORDEM em vez de campo a
    // campo: assim um estado novo no enum entra aqui sozinho, sem virar um
    // `undefined` silencioso nas pílulas de filtro.
    const porStatus = Object.fromEntries(
      STATUS_ORDEM.map((s) => [s, solicitacoes.filter((x) => x.status === s).length])
    ) as Record<StatusSolicitacao, number>;
    return { total: solicitacoes.length, porStatus };
  }, [solicitacoes]);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return solicitacoes.filter((s) => {
      if (filtroStatus !== "todos" && s.status !== filtroStatus) return false;
      if (filtroSetor && s.solicitanteSetor !== filtroSetor) return false;
      if (!termo) return true;
      const alvo = normalizar(
        [
          s.protocolo,
          s.solicitanteNome,
          s.solicitanteSetor,
          s.solicitanteCliente ?? "",
          rotuloTipoMaterial(s.tipoMaterial, s.tipoMaterialOutro),
          s.objetivo,
        ].join(" ")
      );
      return alvo.includes(termo);
    });
  }, [solicitacoes, filtroStatus, filtroSetor, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  // `pagina` pode ter ficado além do fim depois de um filtro apertar a lista.
  // Corrigir no render (em vez de num efeito) evita o quadro intermediário
  // em branco que um setState assíncrono produziria.
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;
  const visiveis = filtradas.slice(inicio, inicio + porPagina);

  // Só os setores que de fato aparecem na lista, somados aos da lista padrão:
  // um seletor com setor que nunca teve pedido só gera filtro vazio.
  const setoresDisponiveis = useMemo(() => {
    const presentes = new Set(solicitacoes.map((s) => s.solicitanteSetor));
    return [...SETORES.filter((s) => presentes.has(s)), ...Array.from(presentes).filter((s) => !SETORES.includes(s as never))];
  }, [solicitacoes]);

  function reiniciarPagina<T>(setter: (v: T) => void) {
    return (valor: T) => {
      setter(valor);
      setPagina(1);
    };
  }

  async function mudarStatus(
    s: SolicitacaoLinha,
    status: StatusSolicitacao,
    observacao?: string
  ) {
    if (s.status === status) return;
    setOcupado(true);
    try {
      const res = await fetch(`/api/solicitacoes/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, observacao }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ message: data.error || "Não foi possível atualizar o status.", tone: "error" });
        return;
      }
      setToast({ message: `${s.protocolo} → ${STATUS_INFO[status].label}.`, tone: "success" });
      router.refresh();
    } catch {
      setToast({ message: "Falha de rede ao atualizar o status.", tone: "error" });
    } finally {
      setOcupado(false);
    }
  }

  /** Abre o diálogo de resposta, sempre com o campo de texto limpo. */
  function abrirResposta(solicitacao: SolicitacaoLinha, acao: AcaoResposta) {
    setTextoAjuste("");
    setErroAjuste(null);
    setRespondendo({ solicitacao, acao });
  }

  /** Aprovar encerra o pedido; ajustar devolve à equipe com a descrição do
   *  que precisa mudar. Reaproveita `mudarStatus`, que já trata erro e
   *  recarrega a lista. */
  async function responderAprovacao() {
    if (!respondendo) return;
    const { solicitacao, acao } = respondendo;

    if (acao === "aprovar") {
      await mudarStatus(solicitacao, StatusSolicitacao.concluido);
    } else {
      // Espelha a regra do servidor para o erro aparecer no campo, junto do
      // que precisa ser corrigido, em vez de voltar como toast genérico.
      if (!textoAjuste.trim()) {
        setErroAjuste(TEXTO_ACAO[acao].erro);
        return;
      }
      setErroAjuste(null);
      const destino =
        acao === "cancelar" ? StatusSolicitacao.cancelado : StatusSolicitacao.ajustes;
      await mudarStatus(solicitacao, destino, textoAjuste.trim());
    }
    setRespondendo(null);
    setTextoAjuste("");
  }

  async function excluir() {
    if (!excluindo) return;
    setOcupado(true);
    try {
      const res = await fetch(`/api/solicitacoes/${excluindo.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ message: data.error || "Não foi possível excluir.", tone: "error" });
        return;
      }
      setToast({ message: `${excluindo.protocolo} excluída.`, tone: "success" });
      setExcluindo(null);
      router.refresh();
    } catch {
      setToast({ message: "Falha de rede ao excluir.", tone: "error" });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 56px)" }}>
      <CFPageHeader
        title="Solicitações de Peças Gráficas"
        subtitle={
          ehAdmin
            ? "Fila completa de produção — todas as solicitações da Seteg, de todos os setores."
            : "Suas solicitações. Quando uma peça ficar pronta, ela aparece aqui como Aguardando Aprovação para você aprovar ou pedir ajustes."
        }
        actions={
          <Btn icon="bi-plus-lg" onClick={() => setNovaAberta(true)}>
            Nova solicitação
          </Btn>
        }
      />

      {/* ─── KPIs ─── */}
      {/* São oito contadores (total + os sete estados). No formato do ui-kit
          eles quebravam em duas linhas e comiam metade da tela antes da
          tabela. Aqui vão numa versão compacta: a descrição de cada estado
          saiu do card e virou `title`, que é o que mais ocupava altura.
          `auto-fit` com mínimo de 116px mantém tudo numa linha só em tela
          cheia e ainda deixa quebrar em telas estreitas. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(116px, 1fr))",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <KpiCompacto
          label="Total"
          valor={metricas.total}
          icone="bi-collection"
          dica={ehAdmin ? "Todas as peças cadastradas" : "Todas as suas peças"}
        />
        {/* Um por estado do fluxo, na ordem em que a peça caminha — a leitura
            da esquerda para a direita mostra onde a fila está presa. */}
        {STATUS_ORDEM.map((s) => (
          <KpiCompacto
            key={s}
            label={STATUS_INFO[s].label}
            valor={metricas.porStatus[s]}
            tom={TOM_KPI[s]}
            icone={STATUS_INFO[s].icon}
            dica={STATUS_INFO[s].descricao}
          />
        ))}
      </div>

      {/* ─── Filtros ─── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <PilulaFiltro
            ativo={filtroStatus === "todos"}
            onClick={() => reiniciarPagina(setFiltroStatus)("todos")}
            rotulo="Todas"
            contagem={metricas.total}
          />
          {STATUS_ORDEM.map((s) => (
            <PilulaFiltro
              key={s}
              ativo={filtroStatus === s}
              onClick={() => reiniciarPagina(setFiltroStatus)(s)}
              rotulo={STATUS_INFO[s].label}
              contagem={metricas.porStatus[s]}
            />
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <select
          className="pmo-select"
          value={filtroSetor}
          onChange={(e) => reiniciarPagina(setFiltroSetor)(e.target.value)}
          aria-label="Filtrar por setor"
          style={{ minWidth: 150 }}
        >
          <option value="">Todos os setores</option>
          {setoresDisponiveis.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: "var(--field-h, 40px)",
            padding: "0 12px",
            background: "var(--surface)",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--r-md)",
            minWidth: 240,
          }}
        >
          <i className="bi bi-search" style={{ fontSize: 12.5, color: "var(--text-faint)" }} />
          <input
            value={busca}
            onChange={(e) => reiniciarPagina(setBusca)(e.target.value)}
            placeholder="Buscar protocolo, solicitante, projeto..."
            aria-label="Buscar solicitações"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "inherit",
              fontSize: 13,
              color: "var(--text)",
              minWidth: 0,
            }}
          />
          {busca && (
            <button
              type="button"
              onClick={() => reiniciarPagina(setBusca)("")}
              aria-label="Limpar busca"
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-faint)", display: "flex" }}
            >
              <i className="bi bi-x-lg" style={{ fontSize: 12 }} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Tabela ─── */}
      {/* O card cresce para ocupar a altura que sobra (`flex: 1`, com o
          wrapper da página em coluna). Quem tem um pedido só via uma faixa
          fina no topo e um vazio embaixo; agora a tabela ocupa a tela e o
          rodapé de paginação fica ancorado na base. */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-card)",
          boxShadow: "var(--shadow-card)",
          overflow: "hidden",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 260,
        }}
      >
        {filtradas.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CFEmptyState
              icon="bi-inbox"
              title={
                solicitacoes.length === 0
                  ? "Nenhuma solicitação ainda"
                  : "Nenhuma solicitação com esses filtros"
              }
              hint={
                solicitacoes.length === 0
                  ? "Clique em “Nova solicitação” para abrir o primeiro pedido."
                  : "Tente limpar a busca ou escolher outro status."
              }
            />
          </div>
        ) : (
          <div style={{ flex: 1, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={TH}>Protocolo</th>
                    {ehAdmin && <th style={TH}>Solicitante</th>}
                    <th style={TH}>Setor</th>
                    <th style={TH}>Tipo</th>
                    <th style={TH}>Canais</th>
                    <th style={TH}>Prazo ideal</th>
                    <th style={TH}>Status</th>
                    <th style={TH}>Tempo</th>
                    <th style={TH}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((s) => (
                    <tr key={s.id}>
                      <td style={{ ...TD, whiteSpace: "nowrap" }}>
                        <strong style={{ fontVariantNumeric: "tabular-nums" }}>{s.protocolo}</strong>
                      </td>
                      {ehAdmin && (
                        <td style={TD} title={s.solicitanteEmail ?? undefined}>
                          {s.solicitanteNome}
                          {s.historico && (
                            <i
                              className="bi bi-clock-history"
                              title="Pedido anterior ao login — sem conta ligada"
                              style={{ marginLeft: 6, fontSize: 11, color: "var(--text-faint)" }}
                            />
                          )}
                        </td>
                      )}
                      <td style={TD}>{s.solicitanteSetor}</td>
                      <td style={TD}>{rotuloTipoMaterial(s.tipoMaterial, s.tipoMaterialOutro)}</td>
                      <td style={TD}>
                        <Canais formatos={s.formatos} outros={s.formatoOutros} />
                      </td>
                      <td style={{ ...TD, whiteSpace: "nowrap" }}>
                        {s.urgente && (
                          <i
                            className="bi bi-exclamation-circle-fill"
                            title="Pedido urgente"
                            style={{ color: "var(--red)", marginRight: 6, fontSize: 12 }}
                          />
                        )}
                        {formatDate(s.prazoIdeal)}
                      </td>
                      <td style={TD}>
                        <CFStatusBadge kind={STATUS_INFO[s.status].kind} label={STATUS_INFO[s.status].label} />
                      </td>
                      <td style={{ ...TD, whiteSpace: "nowrap" }}>
                        <CelulaTempo solicitacao={s} />
                      </td>
                      <td style={{ ...TD, whiteSpace: "nowrap" }}>
                        {/* Com seis estados, um botão por estado viraria uma
                            fileira de sete ícones por linha. Em vez disso: o
                            passo natural em destaque e o resto num menu. */}
                        <div style={{ display: "inline-flex", gap: 4 }}>
                          <BotaoAcao icone="bi-eye" titulo="Ver detalhes" onClick={() => setDetalhe(s)} />
                          {ehAdmin ? (
                            <>
                              <AcoesDeFila
                                status={s.status}
                                ocupado={ocupado}
                                onMover={(destino) =>
                                  // Ir para "Ajuste Pendente" exige dizer o
                                  // quê — inclusive vindo da produção. Passa
                                  // pelo mesmo diálogo do solicitante.
                                  destino === StatusSolicitacao.ajustes
                                    ? abrirResposta(s, "ajustar")
                                    : mudarStatus(s, destino)
                                }
                              />
                              <BotaoAcao
                                icone="bi-trash"
                                titulo="Excluir"
                                perigo
                                disabled={ocupado}
                                onClick={() => setExcluindo(s)}
                              />
                            </>
                          ) : (
                            <>
                              {/* A peça voltou para quem pediu: é ele que
                                  aprova ou manda ajustar. */}
                              {s.status === StatusSolicitacao.aguardando_aprovacao && (
                                <>
                                  <BotaoAcao
                                    icone="bi-check2-circle"
                                    titulo="Aprovar e finalizar"
                                    destaque
                                    disabled={ocupado}
                                    onClick={() => abrirResposta(s, "aprovar")}
                                  />
                                  <BotaoAcao
                                    icone="bi-arrow-counterclockwise"
                                    titulo="Solicitar ajustes"
                                    disabled={ocupado}
                                    onClick={() => abrirResposta(s, "ajustar")}
                                  />
                                </>
                              )}
                              {/* Desistir vale em qualquer ponto antes do fim:
                                  melhor cancelar do que a equipe produzir uma
                                  peça que ninguém vai usar. */}
                              {podeCancelar(s.status) && (
                                <BotaoAcao
                                  icone="bi-x-circle"
                                  titulo="Cancelar solicitação"
                                  perigo
                                  disabled={ocupado}
                                  onClick={() => abrirResposta(s, "cancelar")}
                                />
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        )}

        {/* Fora do condicional: o rodapé aparece sempre, inclusive com a lista
            vazia ou com um único pedido. */}
        <Paginacao
          total={filtradas.length}
          inicio={inicio}
          quantidade={visiveis.length}
          pagina={paginaAtual}
          totalPaginas={totalPaginas}
          porPagina={porPagina}
          onPagina={setPagina}
          onPorPagina={(n) => {
            setPorPagina(n);
            setPagina(1);
          }}
        />
      </div>

      <NovaSolicitacaoModal
        aberto={novaAberta}
        onFechar={() => setNovaAberta(false)}
        setorPadrao={setorPadrao}
        projetos={projetos}
        onCriada={(protocolo) => {
          setNovaAberta(false);
          setToast({ message: `Solicitação ${protocolo} enviada.`, tone: "success" });
          router.refresh();
        }}
      />

      <CFModal
        open={detalhe !== null}
        onClose={() => setDetalhe(null)}
        title={detalhe ? `Solicitação ${detalhe.protocolo}` : ""}
        hint={detalhe ? `Aberta em ${formatDate(detalhe.criadoEm)} por ${detalhe.solicitanteNome}` : undefined}
        icon="bi-file-earmark-image"
        width={760}
        footer={<Btn variant="secondary" onClick={() => setDetalhe(null)}>Fechar</Btn>}
      >
        {detalhe && <DetalheSolicitacao solicitacao={detalhe} />}
      </CFModal>

      <CFModal
        open={respondendo !== null}
        onClose={() => setRespondendo(null)}
        title={respondendo ? TEXTO_ACAO[respondendo.acao].titulo : ""}
        hint={respondendo ? `${respondendo.solicitacao.protocolo} · ${rotuloTipoMaterial(respondendo.solicitacao.tipoMaterial, respondendo.solicitacao.tipoMaterialOutro)}` : undefined}
        icon={respondendo ? TEXTO_ACAO[respondendo.acao].icone : undefined}
        iconColor={respondendo ? TEXTO_ACAO[respondendo.acao].cor : undefined}
        width={480}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setRespondendo(null)} disabled={ocupado}>
              Cancelar
            </Btn>
            <Btn
              variant={respondendo?.acao === "cancelar" ? "danger" : "primary"}
              icon={respondendo ? TEXTO_ACAO[respondendo.acao].icone : undefined}
              onClick={responderAprovacao}
              disabled={ocupado}
            >
              {ocupado ? "Enviando..." : respondendo ? TEXTO_ACAO[respondendo.acao].botao : ""}
            </Btn>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.6, margin: 0 }}>
            {respondendo?.acao === "aprovar" && (
              <>
                A peça será marcada como <strong>Finalizada</strong> e o pedido se encerra. A
                equipe de produção é avisada.
              </>
            )}
            {respondendo?.acao === "ajustar" && (
              <>
                A peça volta para a equipe como <strong>Ajuste Pendente</strong>. Quando os
                ajustes forem feitos, ela retorna para a aprovação.
              </>
            )}
            {respondendo?.acao === "cancelar" && (
              <>
                O pedido passa a <strong>Cancelado</strong> e sai da fila de produção. Ele{" "}
                <strong>continua na sua lista</strong>, com o motivo registrado — cancelar não
                apaga nada.
              </>
            )}
          </p>

          {respondendo && TEXTO_ACAO[respondendo.acao].exigeTexto && (
            <>
              <CFTextarea
                label={TEXTO_ACAO[respondendo.acao].rotuloCampo ?? ""}
                required
                rows={5}
                value={textoAjuste}
                onChange={(v) => {
                  setTextoAjuste(v);
                  if (erroAjuste) setErroAjuste(null);
                }}
                placeholder={TEXTO_ACAO[respondendo.acao].placeholder}
                hint={TEXTO_ACAO[respondendo.acao].dica}
              />
              {erroAjuste && (
                <CFAlert tone="danger" icon="bi-exclamation-circle-fill">
                  {erroAjuste}
                </CFAlert>
              )}
            </>
          )}
        </div>
      </CFModal>

      <CFModal
        open={excluindo !== null}
        onClose={() => setExcluindo(null)}
        title="Excluir solicitação"
        hint="A exclusão é definitiva — o pedido some da fila e do histórico de quem o abriu."
        icon="bi-exclamation-triangle-fill"
        iconColor="var(--red)"
        width={460}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setExcluindo(null)} disabled={ocupado}>
              Cancelar
            </Btn>
            <Btn variant="danger" icon="bi-trash" onClick={excluir} disabled={ocupado}>
              {ocupado ? "Excluindo..." : "Excluir"}
            </Btn>
          </>
        }
      >
        <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.6 }}>
          Excluir <strong>{excluindo?.protocolo}</strong>, de {excluindo?.solicitanteNome}?
        </p>
      </CFModal>

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}

const COR_TOM: Record<string, string> = {
  ok: "var(--green)",
  warn: "var(--yellow)",
  danger: "var(--red)",
  info: "var(--blue)",
  accent: "var(--orange)",
};

/**
 * Contador compacto da faixa de KPIs.
 *
 * É o CFKpi do ui-kit enxugado para caber oito numa linha: o número perde
 * alguns pontos de corpo, o ícone vira um detalhe ao lado do rótulo em vez
 * de um selo próprio, e a descrição do estado sai do card para o `title`.
 * Era a linha de descrição que dobrava a altura — e ela é contexto, não
 * informação que se lê o tempo todo.
 *
 * O número continua em `tabular-nums`: sem isso os valores dançam
 * lateralmente a cada atualização, porque os dígitos têm larguras
 * diferentes.
 */
function KpiCompacto({
  label,
  valor,
  tom,
  icone,
  dica,
}: {
  label: string;
  valor: number;
  tom?: "ok" | "warn" | "danger" | "info" | "accent";
  icone?: string;
  dica?: string;
}) {
  const cor = (tom && COR_TOM[tom]) || "var(--text)";
  return (
    <div
      title={dica}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "9px 11px",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        minWidth: 0,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.3,
          textTransform: "uppercase",
          color: "var(--text-muted)",
          minWidth: 0,
        }}
      >
        {icone && <i className={`bi ${icone}`} style={{ fontSize: 10.5, color: cor, flexShrink: 0 }} />}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </span>
      <span
        style={{
          fontSize: 21,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: -0.4,
          color: tom ? cor : "var(--text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valor}
      </span>
    </div>
  );
}

/**
 * A coluna "Tempo": quanto a peça levou, ou quanto já está levando.
 *
 * Para uma peça finalizada, é o tempo total da demanda — abertura até entrega.
 * Para uma em aberto, é o tempo corrido desde a abertura, que é o número que
 * interessa a quem está esperando. Os dois casos são visualmente distintos
 * porque significam coisas diferentes: um é um fato encerrado, o outro é um
 * contador que ainda anda.
 *
 * Quando o pedido está em aberto e já passou do prazo limite, o número fica
 * vermelho — é a única forma de a tabela avisar sozinha que algo furou o prazo
 * sem ninguém precisar comparar datas de cabeça.
 */
function CelulaTempo({ solicitacao: s }: { solicitacao: SolicitacaoLinha }) {
  const estourouOPrazo =
    s.emAberto && new Date().toISOString().slice(0, 10) > s.prazoLimite;

  return (
    <span
      title={
        s.emAberto
          ? `Aberta em ${formatDate(s.criadoEm)} — ainda em andamento`
          : `Aberta em ${formatDate(s.criadoEm)}, finalizada em ${formatDate(s.concluidoEm)}`
      }
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", lineHeight: 1.3 }}
    >
      <strong
        style={{
          fontSize: 13,
          fontVariantNumeric: "tabular-nums",
          color: estourouOPrazo ? "var(--red)" : s.emAberto ? "var(--text)" : "var(--green)",
        }}
      >
        {formatarDuracao(s.tempoDias)}
      </strong>
      <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
        {s.emAberto ? (estourouOPrazo ? "em atraso" : "em aberto") : "total"}
      </span>
    </span>
  );
}

/**
 * As ações de fila de uma linha: o passo natural em destaque, o resto num
 * menu.
 *
 * "Aguardando Aprovação" é o único estado com duas saídas legítimas — o
 * solicitante aprovou ou pediu ajuste — e as duas aparecem lado a lado,
 * porque ali não existe um "próximo" óbvio para adivinhar.
 *
 * O menu "Mover para" existe como válvula de escape: um clique errado não
 * pode deixar a peça presa num estado sem volta.
 */
function AcoesDeFila({
  status,
  ocupado,
  onMover,
}: {
  status: StatusSolicitacao;
  ocupado: boolean;
  onMover: (destino: StatusSolicitacao) => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  const proximo = PROXIMO_STATUS[status];
  const naAprovacao = status === StatusSolicitacao.aguardando_aprovacao;

  return (
    <>
      {naAprovacao ? (
        SAIDAS_APROVACAO.map((destino) => (
          <BotaoAcao
            key={destino}
            icone={STATUS_INFO[destino].icon}
            // Quem decide aqui é o solicitante; a equipe só registra o que
            // ele respondeu (por telefone, presencialmente, ou porque ele
            // mesmo clicou na própria tela).
            titulo={
              destino === StatusSolicitacao.concluido
                ? "Solicitante aprovou — finalizar"
                : "Solicitante pediu ajuste"
            }
            destaque={destino === StatusSolicitacao.concluido}
            disabled={ocupado}
            onClick={() => onMover(destino)}
          />
        ))
      ) : proximo ? (
        <BotaoAcao
          icone={STATUS_INFO[proximo].icon}
          titulo={`Avançar para ${STATUS_INFO[proximo].label}`}
          destaque
          disabled={ocupado}
          onClick={() => onMover(proximo)}
        />
      ) : null}

      <BotaoAcao
        ref={menuRef}
        icone="bi-three-dots-vertical"
        titulo="Mover para outro estado"
        disabled={ocupado}
        onClick={() => setMenuAberto((v) => !v)}
      />
      <CFPopover open={menuAberto} triggerRef={menuRef} onClose={() => setMenuAberto(false)} width={230} align="right">
        <div
          style={{
            padding: "6px 10px 8px",
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: "var(--text-faint)",
          }}
        >
          Mover para
        </div>
        {STATUS_ORDEM.map((destino) => {
          const atual = destino === status;
          return (
            <button
              key={destino}
              type="button"
              disabled={atual}
              onClick={() => {
                onMover(destino);
                setMenuAberto(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                textAlign: "left",
                padding: "7px 10px",
                background: atual ? "var(--orange-08)" : "transparent",
                border: "none",
                borderRadius: "var(--r-sm)",
                cursor: atual ? "default" : "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: atual ? 700 : 500,
                color: atual ? "var(--orange)" : "var(--text)",
              }}
              onMouseEnter={(e) => {
                if (!atual) e.currentTarget.style.background = "var(--surface-sunken)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = atual ? "var(--orange-08)" : "transparent";
              }}
            >
              <i className={`bi ${STATUS_INFO[destino].icon}`} style={{ fontSize: 12, width: 14 }} />
              <span style={{ flex: 1 }}>{STATUS_INFO[destino].label}</span>
              {atual && <span style={{ fontSize: 10.5, fontWeight: 700 }}>atual</span>}
            </button>
          );
        })}
      </CFPopover>
    </>
  );
}

function PilulaFiltro({
  ativo,
  onClick,
  rotulo,
  contagem,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  contagem: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 32,
        padding: "0 12px",
        borderRadius: "var(--r-pill)",
        border: `1px solid ${ativo ? "var(--orange)" : "var(--border)"}`,
        background: ativo ? "var(--orange-15)" : "var(--surface)",
        color: ativo ? "var(--orange)" : "var(--text-muted)",
        fontFamily: "inherit",
        fontSize: 12.5,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {rotulo}
      <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.75 }}>{contagem}</span>
    </button>
  );
}

const BotaoAcao = forwardRef<
  HTMLButtonElement,
  {
    icone: string;
    titulo: string;
    onClick: () => void;
    /** O passo natural do fluxo — ganha a cor da marca para se destacar dos
     *  botões neutros ao lado. */
    destaque?: boolean;
    perigo?: boolean;
    disabled?: boolean;
  }
>(function BotaoAcao({ icone, titulo, onClick, destaque, perigo, disabled }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 30,
        height: 30,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--r-sm)",
        border: `1px solid ${destaque ? "var(--orange)" : "var(--border)"}`,
        background: destaque ? "var(--orange-15)" : "var(--surface)",
        color: destaque ? "var(--orange)" : perigo ? "var(--red)" : "var(--text-muted)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <i className={`bi ${icone}`} style={{ fontSize: 13 }} />
    </button>
  );
});

function Canais({ formatos, outros }: { formatos: string[]; outros: string | null }) {
  if (formatos.length === 0) return <span style={{ color: "var(--text-faint)" }}>—</span>;

  // Acima de dois canais a célula viraria uma parede de etiquetas e
  // desalinharia as linhas da tabela; o detalhe mostra a lista completa.
  if (formatos.length > 2) {
    return (
      <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>
        {formatos.length} canais
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
      {formatos.map((f) => (
        <span
          key={f}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: "var(--r-pill)",
            background: "var(--surface-sunken)",
            color: "var(--text-muted)",
            fontSize: 11.5,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
          title={f === "outros" && outros ? outros : undefined}
        >
          <i className={`bi ${iconeFormato(f)}`} style={{ fontSize: 10.5 }} />
          {f === "outros" && outros ? outros : rotuloFormato(f)}
        </span>
      ))}
    </span>
  );
}

