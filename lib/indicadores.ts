import { StatusSolicitacao } from "@prisma/client";

// Cálculo dos indicadores de produção pedidos pelo PMO:
//   - tempo de elaboração da peça
//   - tempo aguardando retorno/aprovação do solicitante
//   - tempo entre aprovação e finalização
//   - prazo total da demanda
//   - quantidade e percentual de retrabalhos
//   - cumprimento dos prazos estabelecidos
//
// Tudo sai da trilha de eventos (`solicitacao_eventos`), nunca do estado
// atual: olhando só `solicitacoes.status` dá para saber que uma peça está
// "Finalizado", jamais quanto tempo ela levou nem quantas vezes voltou.
//
// ── Duas decisões que moldam todos os números abaixo ──────────────────────
//
// 1. MEDIANA ao lado da média. Tempo de atendimento tem cauda longa: um único
//    pedido que ficou dois meses parado puxa a média para cima e faz o
//    indicador descrever o outlier, não a rotina. A mediana responde "como é
//    um pedido típico"; a média, "qual o custo total". As duas juntas contam
//    a história inteira — só a média mente.
//
// 2. Eventos INFERIDOS entram só onde não estragam. Os 136 pedidos herdados
//    da versão sem histórico tiveram os eventos reconstruídos a partir de
//    `atualizado_em`, que é uma aproximação. Eles valem para prazo total e
//    cumprimento de prazo (onde só importam início e fim), e são DESCARTADOS
//    nos tempos por etapa — ali a aproximação inventaria número, porque
//    nunca existiu registro de quando a peça entrou em produção.

export interface EventoParaCalculo {
  statusNovo: StatusSolicitacao;
  criadoEm: Date;
  inferido: boolean;
}

export interface SolicitacaoParaCalculo {
  id: string;
  protocolo: string;
  solicitanteSetor: string;
  status: StatusSolicitacao;
  criadoEm: Date;
  prazoIdeal: Date;
  prazoLimite: Date;
  /** Em ordem cronológica. */
  eventos: EventoParaCalculo[];
}

const MS_POR_DIA = 1000 * 60 * 60 * 24;

/** Quanto tempo a peça passou em cada estado, em dias. */
export interface TemposPorEtapa {
  na_fila: number;
  em_andamento: number;
  aguardando_aprovacao: number;
  ajustes: number;
  aprovado: number;
}

export interface SolicitacaoMedida {
  id: string;
  protocolo: string;
  setor: string;
  /** Dias entre a abertura e a finalização. Nulo enquanto não finalizou. */
  prazoTotal: number | null;
  /** Nulo quando não há histórico real para medir etapa a etapa. */
  tempos: TemposPorEtapa | null;
  /** Quantas vezes a peça voltou para ajuste. */
  retrabalhos: number;
  /** Nulo enquanto não finalizou. */
  dentroDoPrazoLimite: boolean | null;
  dentroDoPrazoIdeal: boolean | null;
  /** Dias de atraso sobre o prazo limite; 0 quando saiu no prazo. */
  diasDeAtraso: number | null;
  /** true quando o histórico é reconstruído, e não registrado de verdade. */
  aproximada: boolean;
  /** Pedido cancelado pelo solicitante. Não é "em aberto" nem "entregue":
   *  sai da fila sem virar peça, e por isso não entra em prazo de entrega
   *  nem em cumprimento de prazo. */
  cancelada: boolean;
}

function dias(de: Date, ate: Date): number {
  return Math.max(0, (ate.getTime() - de.getTime()) / MS_POR_DIA);
}

/**
 * Reduz uma solicitação aos números que interessam.
 *
 * O relógio de cada etapa corre do evento que ENTRA nela até o próximo
 * evento; a última etapa, se a peça ainda está viva, corre até agora — é o
 * que faz um pedido parado há duas semanas aparecer como parado, em vez de
 * sumir da conta por não ter "fechado" a etapa.
 */
export function medirSolicitacao(s: SolicitacaoParaCalculo, agora = new Date()): SolicitacaoMedida {
  const eventos = [...s.eventos].sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
  const aproximada = eventos.some((e) => e.inferido);

  // Finalização = primeira vez que chegou em `concluido`. "Primeira" e não
  // "última" porque reabrir um pedido depois de entregue não desfaz o fato de
  // que a entrega aconteceu naquela data.
  const eventoConclusao = eventos.find((e) => e.statusNovo === StatusSolicitacao.concluido);
  const prazoTotal = eventoConclusao ? dias(s.criadoEm, eventoConclusao.criadoEm) : null;

  // Cancelado encerra o pedido sem entrega. Não entra em prazo total nem em
  // cumprimento de prazo — medir "atraso" de uma peça que ninguém quis mais
  // seria penalizar a equipe por uma decisão que não foi dela.
  const eventoCancelamento = eventos.find((e) => e.statusNovo === StatusSolicitacao.cancelado);

  // Cada entrada em `ajustes` é uma volta: o solicitante olhou e pediu
  // mudança. Zero significa aprovado de primeira.
  const retrabalhos = eventos.filter((e) => e.statusNovo === StatusSolicitacao.ajustes).length;

  let tempos: TemposPorEtapa | null = null;
  if (!aproximada && eventos.length > 0) {
    const acumulado: TemposPorEtapa = {
      na_fila: 0,
      em_andamento: 0,
      aguardando_aprovacao: 0,
      ajustes: 0,
      aprovado: 0,
    };
    for (let i = 0; i < eventos.length; i++) {
      const atual = eventos[i];
      const proximo = eventos[i + 1];
      // Depois de encerrado — entregue ou cancelado — o relógio para: o
      // tempo desde então não é tempo de atendimento de ninguém.
      if (
        atual.statusNovo === StatusSolicitacao.concluido ||
        atual.statusNovo === StatusSolicitacao.cancelado
      ) {
        break;
      }
      const fim = proximo ? proximo.criadoEm : agora;
      const etapa = atual.statusNovo as keyof TemposPorEtapa;
      if (etapa in acumulado) acumulado[etapa] += dias(atual.criadoEm, fim);
    }
    tempos = acumulado;
  }

  let dentroDoPrazoLimite: boolean | null = null;
  let dentroDoPrazoIdeal: boolean | null = null;
  let diasDeAtraso: number | null = null;
  if (eventoConclusao) {
    // Comparação por DIA, não por instante: o prazo é uma data ("entregar até
    // 10/10"), então entregar às 23h do dia 10 é dentro do prazo. Comparar
    // timestamps marcaria isso como atraso de algumas horas.
    const diaEntrega = inicioDoDiaUtc(eventoConclusao.criadoEm);
    dentroDoPrazoLimite = diaEntrega.getTime() <= inicioDoDiaUtc(s.prazoLimite).getTime();
    dentroDoPrazoIdeal = diaEntrega.getTime() <= inicioDoDiaUtc(s.prazoIdeal).getTime();
    diasDeAtraso = dentroDoPrazoLimite
      ? 0
      : Math.round(dias(inicioDoDiaUtc(s.prazoLimite), diaEntrega));
  }

  return {
    id: s.id,
    protocolo: s.protocolo,
    setor: s.solicitanteSetor,
    prazoTotal,
    tempos,
    retrabalhos,
    dentroDoPrazoLimite,
    dentroDoPrazoIdeal,
    diasDeAtraso,
    aproximada,
    cancelada: eventoCancelamento !== undefined,
  };
}

/** As datas de prazo são `@db.Date` (sem hora) e a conclusão é timestamptz.
 *  Normalizar as duas para a meia-noite UTC é o que torna a comparação justa. */
function inicioDoDiaUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface Resumo {
  media: number | null;
  mediana: number | null;
  amostra: number;
}

function resumir(valores: number[]): Resumo {
  if (valores.length === 0) return { media: null, mediana: null, amostra: 0 };
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return {
    media: valores.reduce((t, v) => t + v, 0) / valores.length,
    mediana:
      ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio],
    amostra: valores.length,
  };
}

export interface Indicadores {
  /** Quantas solicitações entraram no recorte. */
  total: number;
  finalizadas: number;
  /** Ainda em andamento. NÃO inclui as canceladas: elas saíram da fila. */
  emAberto: number;
  canceladas: number;
  /** Com histórico real de etapas — base dos tempos por etapa. */
  comHistoricoReal: number;
  /** Herdadas da versão sem histórico — entram só em prazo e cumprimento. */
  aproximadas: number;

  prazoTotal: Resumo;
  elaboracao: Resumo;
  aguardandoSolicitante: Resumo;
  aprovacaoAteFinalizacao: Resumo;
  naFila: Resumo;
  emAjustes: Resumo;

  retrabalho: {
    /** Soma de todas as voltas para ajuste. */
    total: number;
    /** Solicitações que voltaram ao menos uma vez. */
    comRetrabalho: number;
    /** Quantas solicitações formam a base do percentual (só as com
     *  histórico real — uma trilha reconstruída não registra voltas). */
    base: number;
    /** Percentual de solicitações que voltaram ao menos uma vez. */
    percentual: number | null;
    /** Média de voltas por solicitação. */
    mediaPorSolicitacao: number | null;
  };

  prazos: {
    avaliadas: number;
    noPrazoLimite: number;
    atrasadas: number;
    noPrazoIdeal: number;
    percentualNoPrazoLimite: number | null;
    percentualNoPrazoIdeal: number | null;
    atrasoMedioEmDias: number | null;
  };

  /** Composição do tempo médio, para a barra empilhada. */
  composicao: { etapa: string; label: string; dias: number; cor: string }[];
}

const COR_ETAPA: Record<keyof TemposPorEtapa, { label: string; cor: string }> = {
  na_fila: { label: "Na fila", cor: "var(--yellow)" },
  em_andamento: { label: "Elaboração", cor: "var(--orange)" },
  aguardando_aprovacao: { label: "Com o solicitante", cor: "var(--text-faint)" },
  ajustes: { label: "Ajustes", cor: "var(--blue)" },
  aprovado: { label: "Aprovação → entrega", cor: "var(--green)" },
};

export function calcularIndicadores(medidas: SolicitacaoMedida[]): Indicadores {
  const comHistorico = medidas.filter((m) => m.tempos !== null);
  const finalizadas = medidas.filter((m) => m.prazoTotal !== null);
  const canceladas = medidas.filter((m) => m.cancelada);
  const avaliadas = medidas.filter((m) => m.dentroDoPrazoLimite !== null);

  const tempoDe = (etapa: keyof TemposPorEtapa) =>
    resumir(comHistorico.map((m) => m.tempos![etapa]));

  // Retrabalho SÓ sobre quem tem histórico real, como os tempos por etapa.
  // Uma trilha reconstruída não tem como registrar uma volta para ajuste —
  // ela só conhece o começo e o fim. Contá-la como "zero retrabalhos" não
  // seria medir zero, seria diluir o indicador sobre casos em que ele é
  // desconhecido, e o número sairia artificialmente baixo.
  const comRetrabalho = comHistorico.filter((m) => m.retrabalhos > 0).length;
  const totalRetrabalhos = comHistorico.reduce((t, m) => t + m.retrabalhos, 0);

  const noPrazoLimite = avaliadas.filter((m) => m.dentroDoPrazoLimite).length;
  const noPrazoIdeal = avaliadas.filter((m) => m.dentroDoPrazoIdeal).length;
  const atrasadas = avaliadas.length - noPrazoLimite;
  const atrasos = avaliadas.filter((m) => !m.dentroDoPrazoLimite).map((m) => m.diasDeAtraso ?? 0);

  const composicao = (Object.keys(COR_ETAPA) as (keyof TemposPorEtapa)[])
    .map((etapa) => ({
      etapa,
      label: COR_ETAPA[etapa].label,
      dias: tempoDe(etapa).media ?? 0,
      cor: COR_ETAPA[etapa].cor,
    }))
    .filter((c) => c.dias > 0);

  const pct = (parte: number, todo: number) => (todo > 0 ? (parte / todo) * 100 : null);

  return {
    total: medidas.length,
    finalizadas: finalizadas.length,
    // Cancelada não é "em aberto": ninguém está esperando por ela. Somá-la
    // aqui inflaria para sempre o número de pedidos pendentes.
    emAberto: medidas.length - finalizadas.length - canceladas.length,
    canceladas: canceladas.length,
    comHistoricoReal: comHistorico.length,
    aproximadas: medidas.filter((m) => m.aproximada).length,

    prazoTotal: resumir(finalizadas.map((m) => m.prazoTotal!)),
    elaboracao: tempoDe("em_andamento"),
    aguardandoSolicitante: tempoDe("aguardando_aprovacao"),
    aprovacaoAteFinalizacao: tempoDe("aprovado"),
    naFila: tempoDe("na_fila"),
    emAjustes: tempoDe("ajustes"),

    retrabalho: {
      total: totalRetrabalhos,
      comRetrabalho,
      /** Base: só as solicitações com histórico real — ver comentário acima. */
      base: comHistorico.length,
      percentual: pct(comRetrabalho, comHistorico.length),
      mediaPorSolicitacao:
        comHistorico.length > 0 ? totalRetrabalhos / comHistorico.length : null,
    },

    prazos: {
      avaliadas: avaliadas.length,
      noPrazoLimite,
      atrasadas,
      noPrazoIdeal,
      percentualNoPrazoLimite: pct(noPrazoLimite, avaliadas.length),
      percentualNoPrazoIdeal: pct(noPrazoIdeal, avaliadas.length),
      atrasoMedioEmDias: atrasos.length > 0 ? atrasos.reduce((t, v) => t + v, 0) / atrasos.length : null,
    },

    composicao,
  };
}

/** Formata uma duração em dias para leitura humana: "3,5 d", "18 h", "—". */
export function formatarDuracao(valorEmDias: number | null): string {
  if (valorEmDias === null) return "—";
  if (valorEmDias < 1) {
    const horas = valorEmDias * 24;
    if (horas < 1) return `${Math.round(horas * 60)} min`;
    return `${horas.toFixed(1).replace(".", ",")} h`;
  }
  return `${valorEmDias.toFixed(1).replace(".", ",")} d`;
}

export function formatarPercentual(valor: number | null): string {
  if (valor === null) return "—";
  return `${valor.toFixed(0)}%`;
}
