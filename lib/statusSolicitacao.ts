import { StatusSolicitacao } from "@prisma/client";

// O fluxo de produção de uma peça: rótulos, cores e o caminho natural entre
// os estados.
//
// Os quatro primeiros vêm da versão anterior do SGA, com a mesma
// nomenclatura — quem já usa o sistema não precisa reaprender nada. Os dois
// novos (Aguardando Aprovação e Aprovado) entraram junto com o dashboard: sem
// eles não há como separar "tempo em que a equipe trabalhou" de "tempo em que
// a peça ficou parada esperando o solicitante".
//
// `kind` alimenta o CFStatusBadge do ui-kit, que conhece um conjunto fixo de
// chaves; cada status aponta para uma chave existente, escolhida pela cor.

export const STATUS_INFO: Record<
  StatusSolicitacao,
  { label: string; kind: string; icon: string; descricao: string }
> = {
  na_fila: {
    label: "Na Fila",
    kind: "em_validacao", // amarelo
    icon: "bi-hourglass-split",
    descricao: "Aguardando a equipe pegar",
  },
  em_andamento: {
    label: "Em Andamento",
    kind: "standby", // laranja
    icon: "bi-pencil-fill",
    descricao: "Em produção pela equipe",
  },
  aguardando_aprovacao: {
    label: "Aguardando Aprovação",
    kind: "rascunho", // cinza
    icon: "bi-send-check",
    descricao: "Entregue; com o solicitante",
  },
  ajustes: {
    label: "Ajuste Pendente",
    kind: "finalizado", // azul
    icon: "bi-arrow-counterclockwise",
    descricao: "Solicitante pediu mudança",
  },
  aprovado: {
    label: "Aprovado",
    kind: "ativo", // verde claro
    icon: "bi-hand-thumbs-up",
    descricao: "Aprovado; fechando arquivos",
  },
  concluido: {
    label: "Finalizado",
    kind: "aprovado", // verde
    icon: "bi-check2-circle",
    descricao: "Concluído e entregue",
  },
  cancelado: {
    label: "Cancelado",
    kind: "cancelado", // vermelho
    icon: "bi-x-circle",
    descricao: "Solicitante desistiu",
  },
};

/** Ordem do fluxo. Usada nas pílulas de filtro e na composição do dashboard. */
export const STATUS_ORDEM: StatusSolicitacao[] = [
  StatusSolicitacao.na_fila,
  StatusSolicitacao.em_andamento,
  StatusSolicitacao.aguardando_aprovacao,
  StatusSolicitacao.ajustes,
  StatusSolicitacao.aprovado,
  StatusSolicitacao.concluido,
  StatusSolicitacao.cancelado,
];

/**
 * O próximo passo natural de cada estado — o que o botão "avançar" faz.
 *
 * De `aguardando_aprovacao` saem DOIS caminhos (aprovou ou pediu ajuste), e
 * quem decide é o solicitante, não o sistema; por isso ali não há um "próximo"
 * único e a tela oferece as duas saídas lado a lado.
 *
 * Isto é um atalho de interface, não uma trava: qualquer admin pode mover uma
 * solicitação para qualquer estado pelo menu "Mover para". Travar o caminho
 * criaria mais problema do que resolve — basta um clique errado para a peça
 * ficar presa num estado sem volta.
 */
export const PROXIMO_STATUS: Partial<Record<StatusSolicitacao, StatusSolicitacao>> = {
  [StatusSolicitacao.na_fila]: StatusSolicitacao.em_andamento,
  [StatusSolicitacao.em_andamento]: StatusSolicitacao.aguardando_aprovacao,
  [StatusSolicitacao.ajustes]: StatusSolicitacao.em_andamento,
  [StatusSolicitacao.aprovado]: StatusSolicitacao.concluido,
};

/** Estados terminais: a peça saiu da fila e o relógio para. Cancelado entra
 *  aqui junto com Finalizado — os dois encerram o pedido, mesmo que por
 *  motivos opostos. */
export const STATUS_FINAIS: StatusSolicitacao[] = [
  StatusSolicitacao.concluido,
  StatusSolicitacao.cancelado,
];
/**
 * As duas saídas de "Aguardando Aprovação" — e quem decide é o SOLICITANTE,
 * não a equipe de produção.
 *
 * Aprovar leva direto a Finalizado: para quem pediu a peça, "está boa" e
 * "acabou" são a mesma coisa, e um passo intermediário só faria o pedido
 * parecer pendente depois de resolvido. Pedir ajuste devolve a peça para a
 * fila da equipe, e o ciclo recomeça em Em Andamento → Aguardando Aprovação.
 */
export const SAIDAS_APROVACAO: StatusSolicitacao[] = [
  StatusSolicitacao.concluido,
  StatusSolicitacao.ajustes,
];

/**
 * O solicitante pode mover a PRÓPRIA peça, e só nesta situação: quando ela
 * está aguardando a avaliação dele, para aprovar ou pedir ajuste.
 *
 * Esta função é a fonte única da regra — usada pela tela (para decidir quais
 * botões mostrar) e pela rota de API (para decidir se aceita a mudança). Fora
 * disso, mover a fila continua sendo da equipe de produção; do contrário um
 * solicitante marcaria o próprio pedido como Finalizado sem ele existir.
 */
export function solicitantePodeMover(
  statusAtual: StatusSolicitacao,
  destino: StatusSolicitacao
): boolean {
  // Responder à aprovação da própria peça.
  if (
    statusAtual === StatusSolicitacao.aguardando_aprovacao &&
    SAIDAS_APROVACAO.includes(destino)
  ) {
    return true;
  }
  // Desistir do pedido, enquanto ele não terminou. Quem pediu pode deixar de
  // precisar — e é melhor ele cancelar do que a equipe produzir uma peça que
  // ninguém vai usar. Depois de finalizado ou já cancelado não há o que
  // desistir.
  return destino === StatusSolicitacao.cancelado && !STATUS_FINAIS.includes(statusAtual);
}

/** O solicitante pode desistir enquanto a peça não terminou. */
export function podeCancelar(statusAtual: StatusSolicitacao): boolean {
  return !STATUS_FINAIS.includes(statusAtual);
}


export function rotuloStatus(status: StatusSolicitacao): string {
  return STATUS_INFO[status]?.label ?? String(status);
}

export function isStatusValido(valor: unknown): valor is StatusSolicitacao {
  return typeof valor === "string" && valor in STATUS_INFO;
}
