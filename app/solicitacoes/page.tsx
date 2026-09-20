import { prisma } from "@/lib/prisma";
import { podeVerTudo, requireUsuario } from "@/lib/session";
import { listarProjetos } from "@/lib/projetos";
import SolicitacoesClient from "./SolicitacoesClient";
import { STATUS_FINAIS } from "@/lib/statusSolicitacao";
import { EtapaSolicitacao, SolicitacaoLinha } from "./tipos";

export const dynamic = "force-dynamic";

export default async function SolicitacoesPage() {
  const sessao = await requireUsuario();
  const vejoTudo = podeVerTudo(sessao);

  // Aqui mora a regra "cada solicitante só vê as suas". A filtragem é feita
  // na CONSULTA, não na tela: se fosse um `.filter()` no cliente, os pedidos
  // das outras pessoas ainda teriam sido enviados ao navegador e estariam
  // visíveis no payload da página para quem soubesse olhar.
  const [solicitacoes, usuarioAtual, projetos] = await Promise.all([
    prisma.solicitacao.findMany({
      where: vejoTudo ? {} : { solicitanteId: sessao.id },
      include: {
        solicitante: { select: { nome: true, email: true } },
        // A trilha de etapas vem junto: é dela que saem a data de conclusão,
        // o tempo total e a linha do tempo do modal de detalhes.
        eventos: {
          select: {
            statusNovo: true,
            criadoEm: true,
            inferido: true,
            observacao: true,
            usuario: { select: { nome: true } },
          },
          orderBy: { criadoEm: "asc" },
        },
      },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.usuario.findUnique({ where: { id: sessao.id }, select: { setor: true } }),
    // Carregada aqui, no servidor, porque o autocomplete precisa dela assim
    // que o formulário abre. Devolve [] se a consulta falhar — o campo vira
    // texto livre e o resto segue funcionando.
    listarProjetos(),
  ]);

  const agora = Date.now();
  const MS_POR_DIA = 1000 * 60 * 60 * 24;

  const linhas: SolicitacaoLinha[] = solicitacoes.map((s) => {
    // Encerramento = PRIMEIRA vez que o pedido chegou a um estado final,
    // entregue OU cancelado. "Primeira" e não "última" porque reabrir um
    // pedido depois de encerrado não desfaz o fato de que ele encerrou
    // naquela data. Mesma regra de lib/indicadores.
    //
    // Cancelado encerra pelo mesmo motivo que Finalizado: este relógio mede
    // tempo de atendimento, e depois que ninguém mais espera a peça não há
    // atendimento acontecendo. Antes só `concluido` parava o contador, então
    // um pedido cancelado seguia somando dias para sempre — e ainda aparecia
    // em vermelho "em atraso", cobrado por um prazo que deixou de valer no
    // instante em que o solicitante desistiu.
    const encerramento = s.eventos.find((e) => STATUS_FINAIS.includes(e.statusNovo));
    const fim = encerramento ? encerramento.criadoEm.getTime() : agora;

    const etapas: EtapaSolicitacao[] = s.eventos.map((e, indice) => {
      const proximo = s.eventos[indice + 1];
      // A etapa corrente (sem próximo evento) conta até agora — é o que faz um
      // pedido parado há duas semanas mostrar duas semanas, em vez de zero.
      //
      // Um estado FINAL sem próximo evento é a exceção: ele é o ponto de
      // chegada, não um estágio em que a peça está parada. Contar até agora
      // faria "Cancelado" exibir uma duração que cresce sozinha, como se
      // alguém ainda estivesse cancelando.
      const pontoDeChegada = !proximo && STATUS_FINAIS.includes(e.statusNovo);
      const ate = proximo ? proximo.criadoEm.getTime() : agora;
      return {
        status: e.statusNovo,
        em: e.criadoEm.toISOString(),
        por: e.usuario?.nome ?? null,
        duracaoDias: pontoDeChegada ? 0 : Math.max(0, (ate - e.criadoEm.getTime()) / MS_POR_DIA),
        aproximada: e.inferido,
        observacao: e.observacao,
      };
    });

    return {
      id: s.id,
      protocolo: s.protocolo,
      encerradoEm: encerramento ? encerramento.criadoEm.toISOString() : null,
      encerradoPor: encerramento?.usuario?.nome ?? null,
      tempoDias: Math.max(0, (fim - s.criadoEm.getTime()) / MS_POR_DIA),
      emAberto: !encerramento,
      etapas,
      // Sem conta ligada, cai no nome digitado à mão na versão antiga do
      // sistema; sem nem isso, um travessão — nunca uma string vazia, que na
      // tabela vira uma célula misteriosamente em branco.
      solicitanteNome: s.solicitante?.nome ?? s.solicitanteNomeLegado ?? "—",
      solicitanteEmail: s.solicitante?.email ?? null,
      historico: s.solicitante === null,
      solicitanteSetor: s.solicitanteSetor,
      solicitanteCliente: s.solicitanteCliente,
      prazoIdeal: s.prazoIdeal.toISOString().slice(0, 10),
      prazoLimite: s.prazoLimite.toISOString().slice(0, 10),
      urgente: s.urgente,
      urgenciaJustificativa: s.urgenciaJustificativa,
      tipoMaterial: s.tipoMaterial,
      tipoMaterialOutro: s.tipoMaterialOutro,
      objetivo: s.objetivo,
      conteudo: s.conteudo,
      infoObrigatorias: s.infoObrigatorias,
      formatos: s.formatos,
      formatoOutros: s.formatoOutros,
      dimensoes: s.dimensoes,
      paginas: s.paginas,
      identidadeVisual: s.identidadeVisual,
      identidadeDiretorio: s.identidadeDiretorio,
      referenciasDiretorio: s.referenciasDiretorio,
      materiaisDiretorio: s.materiaisDiretorio,
      observacoes: s.observacoes,
      status: s.status,
      criadoEm: s.criadoEm.toISOString(),
    };
  });

  return (
    <SolicitacoesClient
      solicitacoes={linhas}
      ehAdmin={vejoTudo}
      setorPadrao={usuarioAtual?.setor ?? ""}
      projetos={projetos}
    />
  );
}
