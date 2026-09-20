import { NextRequest, NextResponse } from "next/server";
import { StatusSolicitacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUsuarioSessao } from "@/lib/session";
import { gerarProtocolo } from "@/lib/protocolo";
import { registrarLog } from "@/lib/log";
import { notificarTeams } from "@/lib/teams";
import { rotuloTipoMaterial } from "@/lib/solicitacaoListas";
import { validarSolicitacao } from "./validacao";

export const dynamic = "force-dynamic";

/**
 * POST /api/solicitacoes — abre um pedido de peça gráfica.
 *
 * Qualquer pessoa autenticada pode abrir. O pedido nasce SEMPRE em `na_fila`
 * e SEMPRE no nome de quem está logado: o `solicitanteId` vem da sessão, não
 * do corpo da requisição. Do contrário daria para abrir pedido no nome de
 * outra pessoa, e a regra "cada solicitante só vê as suas" viraria um detalhe
 * cosmético.
 */
export async function POST(request: NextRequest) {
  const sessao = await getUsuarioSessao();
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const validacao = validarSolicitacao(body);
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }

  try {
    const solicitacao = await prisma.solicitacao.create({
      data: {
        ...validacao.dados,
        protocolo: await gerarProtocolo(),
        solicitanteId: sessao.id,
        // O evento de abertura nasce junto com a solicitação, na mesma
        // escrita: é o marco zero de todos os tempos do dashboard, e um
        // pedido sem ele ficaria fora dos indicadores para sempre.
        eventos: {
          create: {
            statusAnterior: null,
            statusNovo: StatusSolicitacao.na_fila,
            usuarioId: sessao.id,
          },
        },
      },
    });

    await registrarLog("criar", "solicitacoes", solicitacao.id, sessao.id, {
      protocolo: solicitacao.protocolo,
      setor: solicitacao.solicitanteSetor,
    });

    // Notificação depois da gravação, e nunca propagando erro (ver
    // lib/teams.ts): se o Power Automate estiver fora do ar, o pedido já está
    // salvo e não faz sentido mostrar falha a quem acabou de enviá-lo.
    await notificarTeams(
      `Nova solicitação — ${solicitacao.protocolo}`,
      [
        { title: "Solicitante", value: sessao.nome },
        { title: "Setor", value: solicitacao.solicitanteSetor },
        {
          title: "Tipo de material",
          value: rotuloTipoMaterial(solicitacao.tipoMaterial, solicitacao.tipoMaterialOutro),
        },
        { title: "Prazo ideal", value: solicitacao.prazoIdeal.toISOString().slice(0, 10) },
        { title: "Prazo limite", value: solicitacao.prazoLimite.toISOString().slice(0, 10) },
        { title: "Urgente", value: solicitacao.urgente ? "Sim" : "Não" },
      ],
      solicitacao.objetivo
    );

    return NextResponse.json({ id: solicitacao.id, protocolo: solicitacao.protocolo }, { status: 201 });
  } catch (erro) {
    console.error("[POST /api/solicitacoes]", erro);
    return NextResponse.json({ error: "Não foi possível salvar a solicitação." }, { status: 500 });
  }
}
