import { StatusSolicitacao } from "@prisma/client";

/**
 * Forma de uma solicitação como ela chega do Server Component ao Client
 * Component.
 *
 * Datas viajam como string ISO (AAAA-MM-DD para os prazos, ISO completo para
 * `criadoEm`), não como `Date`: o que atravessa a fronteira servidor→cliente
 * no App Router é serializado, e um `Date` chega do outro lado já convertido
 * — melhor explicitar o formato aqui do que descobrir na tela.
 */
export interface SolicitacaoLinha {
  id: string;
  protocolo: string;

  /** Nome já resolvido no servidor: o da conta dona do pedido ou, nos
   *  registros históricos sem conta, o que foi digitado à mão na época. */
  solicitanteNome: string;
  /** Nulo nos registros históricos sem conta ligada. */
  solicitanteEmail: string | null;
  /** True quando o pedido é anterior ao login e não tem dono — só admin o vê,
   *  e a tela marca isso para ninguém achar que a conta sumiu. */
  historico: boolean;
  solicitanteSetor: string;
  solicitanteCliente: string | null;

  /** AAAA-MM-DD */
  prazoIdeal: string;
  /** AAAA-MM-DD */
  prazoLimite: string;

  urgente: boolean;
  urgenciaJustificativa: string | null;

  tipoMaterial: string;
  tipoMaterialOutro: string | null;

  objetivo: string;
  conteudo: string;
  infoObrigatorias: string;

  formatos: string[];
  formatoOutros: string | null;

  dimensoes: string | null;
  paginas: number | null;

  identidadeVisual: boolean;
  identidadeDiretorio: string | null;

  referenciasDiretorio: string | null;
  materiaisDiretorio: string | null;
  observacoes: string | null;

  status: StatusSolicitacao;
  /** ISO completo */
  criadoEm: string;

  /**
   * ISO completo da primeira vez que o pedido chegou a um estado FINAL —
   * Finalizado ou Cancelado. Nulo enquanto ele ainda está vivo.
   *
   * Os dois casos moram no mesmo campo porque para o relógio são a mesma
   * coisa: o ponto em que o pedido deixou de ser atendido. Qual dos dois
   * aconteceu, `status` já diz — é ele que decide o rótulo na tela.
   */
  encerradoEm: string | null;

  /** Quem encerrou (finalizou ou cancelou) — vem da conta que fez a ação.
   *  Nulo nos registros anteriores ao login, em que não há autor conhecido. */
  encerradoPor: string | null;

  /**
   * Tempo decorrido em dias.
   *
   * Para um pedido encerrado, é o total: da abertura até o encerramento — a
   * entrega, se foi finalizado; o cancelamento, se o solicitante desistiu.
   * Para um em aberto, é quanto tempo já se passou desde a abertura, o número
   * que interessa a quem está esperando e que cresce enquanto o pedido não
   * anda. `emAberto` diz qual dos dois é.
   */
  tempoDias: number;
  /** Falso assim que o pedido encerra, inclusive por cancelamento: um pedido
   *  cancelado não está em aberto, e por isso também não pode estar "em
   *  atraso". */
  emAberto: boolean;

  /** A trilha de mudanças de status, em ordem. */
  etapas: EtapaSolicitacao[];
}

export interface EtapaSolicitacao {
  status: StatusSolicitacao;
  /** ISO completo de quando entrou neste status. */
  em: string;
  /** Quem moveu. Nulo nos registros reconstruídos da versão sem login. */
  por: string | null;
  /** Dias que a peça passou neste status. Para a etapa atual, conta até
   *  agora; para um estado final, é sempre 0 — ele é o ponto de chegada, não
   *  um estágio em que a peça ficou. */
  duracaoDias: number;
  /** true quando a data é reconstruída, e não registrada de verdade. */
  aproximada: boolean;
  /** O que foi pedido nesta etapa. Só existe nas voltas para Ajuste
   *  Pendente — é o texto que a equipe lê para saber o que refazer. */
  observacao: string | null;
}
