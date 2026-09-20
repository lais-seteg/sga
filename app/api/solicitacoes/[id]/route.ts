import { NextRequest, NextResponse } from "next/server";
import { Papel, Prisma, StatusSolicitacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUsuarioSessao } from "@/lib/session";
import { registrarLog } from "@/lib/log";
import { notificarTeams } from "@/lib/teams";
import { isStatusValido, rotuloStatus, solicitantePodeMover } from "@/lib/statusSolicitacao";
import { rotuloTipoMaterial } from "@/lib/solicitacaoListas";

export const dynamic = "force-dynamic";

/** Folga generosa: a descrição dos ajustes costuma ser um parágrafo, mas
 *  nada impede alguém de colar uma lista longa. O limite existe só para
 *  barrar payload absurdo. */
const OBSERVACAO_MAX = 5000;

/**
 * PATCH /api/solicitacoes/[id] — muda o status.
 *
 * Duas autorizações diferentes convivem aqui:
 *
 * - **Admin** move a fila livremente: é quem produz a peça e sabe em que
 *   estágio ela está.
 * - **O solicitante** move a PRÓPRIA peça, e só quando ela está aguardando a
 *   avaliação dele — para aprovar (vai direto a Finalizado) ou pedir ajuste.
 *   A regra vive em `solicitantePodeMover`, compartilhada com a tela.
 *
 * Sem esse recorte, um solicitante marcaria o próprio pedido como Finalizado
 * sem ele nunca ter sido produzido.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getUsuarioSessao();
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (!isStatusValido(body.status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  const novoStatus = body.status;

  // Mover para "Ajuste Pendente" exige dizer O QUE ajustar. Sem isso a peça
  // volta para a equipe sem informação nenhuma, e o designer descobre que há
  // retrabalho mas não o que refazer. Vale para qualquer pessoa — solicitante
  // ou produção — para que toda volta no histórico tenha um motivo legível.
  const observacaoBruta = typeof body.observacao === "string" ? body.observacao.trim() : "";
  if (novoStatus === StatusSolicitacao.ajustes && !observacaoBruta) {
    return NextResponse.json(
      { error: "Descreva quais ajustes são necessários." },
      { status: 400 }
    );
  }
  if (observacaoBruta.length > OBSERVACAO_MAX) {
    return NextResponse.json(
      { error: `A descrição dos ajustes deve ter no máximo ${OBSERVACAO_MAX} caracteres.` },
      { status: 400 }
    );
  }
  // Só guarda a observação onde ela significa algo; nas outras transições
  // viraria texto órfão que a linha do tempo nunca mostra.
  const observacao = novoStatus === StatusSolicitacao.ajustes ? observacaoBruta : null;

  // Precisa do estado ANTERIOR para registrar a transição; sem ele o
  // histórico viraria uma lista de destinos sem origem, e não daria para
  // reconstruir quanto tempo a peça passou em cada etapa. O `solicitanteId`
  // vem junto porque a autorização abaixo depende dele.
  const antes = await prisma.solicitacao.findUnique({
    where: { id: params.id },
    select: { status: true, solicitanteId: true },
  });
  if (!antes) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }

  const ehAdmin = sessao.papel === Papel.admin;
  const ehDono = antes.solicitanteId === sessao.id;
  if (!ehAdmin && !(ehDono && solicitantePodeMover(antes.status, novoStatus))) {
    // Mesma resposta para "não é sua" e "não pode fazer isso agora":
    // distinguir revelaria a existência de pedidos de outras pessoas.
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  if (antes.status === novoStatus) {
    return NextResponse.json({ ok: true, status: novoStatus });
  }

  try {
    const solicitacao = await prisma.solicitacao.update({
      where: { id: params.id },
      data: {
        status: novoStatus,
        // Estado e evento na MESMA escrita: se fossem dois comandos separados,
        // uma falha no meio deixaria a solicitação num estado sem o evento
        // correspondente, e os tempos do dashboard sairiam errados para
        // sempre — sem ninguém perceber.
        eventos: {
          create: {
            statusAnterior: antes.status,
            statusNovo: novoStatus,
            usuarioId: sessao.id,
            observacao,
          },
        },
      },
      include: { solicitante: { select: { nome: true } } },
    });

    await registrarLog("mudar_status", "solicitacoes", solicitacao.id, sessao.id, {
      protocolo: solicitacao.protocolo,
      status: novoStatus,
    });

    await notificarTeams(
      `Status atualizado — ${solicitacao.protocolo}`,
      [
        // `solicitante` é nulo nos pedidos anteriores ao login; nesses, o
        // nome disponível é o que foi digitado à mão na época.
        {
          title: "Solicitante",
          value: solicitacao.solicitante?.nome ?? solicitacao.solicitanteNomeLegado ?? "—",
        },
        {
          title: "Tipo de material",
          value: rotuloTipoMaterial(solicitacao.tipoMaterial, solicitacao.tipoMaterialOutro),
        },
        { title: "Novo status", value: rotuloStatus(novoStatus) },
        { title: "Atualizado por", value: sessao.nome },
      ],
      // A descrição dos ajustes vai no corpo do card: é a informação de que a
      // equipe precisa para agir, e exigir que abram o sistema para lê-la
      // anularia metade do motivo de existir a notificação.
      observacao ? `Ajustes pedidos: ${observacao}` : null
    );

    return NextResponse.json({ ok: true, status: solicitacao.status });
  } catch (erro) {
    // P2025 = "registro não encontrado" no update/delete do Prisma.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
    }
    console.error("[PATCH /api/solicitacoes/[id]]", erro);
    return NextResponse.json({ error: "Não foi possível atualizar o status." }, { status: 500 });
  }
}

/** DELETE /api/solicitacoes/[id] — exclui o pedido. Exclusivo de admin. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getUsuarioSessao();
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (sessao.papel !== Papel.admin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const solicitacao = await prisma.solicitacao.delete({ where: { id: params.id } });
    // O log guarda protocolo e dono porque a linha some do banco: sem isso, a
    // auditoria de uma exclusão seria um id que não aponta mais para nada.
    await registrarLog("excluir", "solicitacoes", solicitacao.id, sessao.id, {
      protocolo: solicitacao.protocolo,
      solicitanteId: solicitacao.solicitanteId,
      status: solicitacao.status,
    });
    return NextResponse.json({ ok: true });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
    }
    console.error("[DELETE /api/solicitacoes/[id]]", erro);
    return NextResponse.json({ error: "Não foi possível excluir a solicitação." }, { status: 500 });
  }
}
