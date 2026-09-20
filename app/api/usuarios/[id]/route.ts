import { NextRequest, NextResponse } from "next/server";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUsuarioSessao } from "@/lib/session";
import { hashSenha } from "@/lib/auth";
import { registrarLog } from "@/lib/log";
import { SETOR_MAX } from "@/lib/solicitacaoListas";
import { NOME_MAX, SENHA_MAX, SENHA_MIN, SENHA_MSG } from "@/lib/politicaConta";

export const dynamic = "force-dynamic";

const PAPEIS_VALIDOS = Object.values(Papel) as string[];

/**
 * PATCH /api/usuarios/[id] — edita nome, setor, perfil, situação e senha.
 * Exclusivo de admin.
 *
 * Campo omitido fica como está: nenhum PATCH parcial zera nada por acidente.
 *
 * O e-mail não é editável de propósito. Ele é a identidade da conta e o dono
 * de todas as solicitações já abertas por ela; trocar o e-mail transferiria
 * silenciosamente o histórico de uma pessoa para outra. Para substituir
 * alguém, desative a conta e crie outra.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getUsuarioSessao();
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  // Mexer em contas exige a permissão específica, não só ser admin: as duas
  // admin da produção movem a fila, mas só quem tem `gerenciaAcessos` cria
  // conta, troca senha e desativa gente. Relido do banco por getUsuarioSessao,
  // então retirar a permissão vale na hora, não no próximo login.
  if (!sessao.gerenciaAcessos) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const alvo = await prisma.usuario.findUnique({ where: { id: params.id } });
  if (!alvo) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

  const data: Prisma.UsuarioUpdateInput = {};
  const camposAlterados: string[] = [];

  /**
   * Só registra na auditoria o que REALMENTE mudou.
   *
   * A tela envia o formulário inteiro a cada salvamento, então sem esta
   * comparação o log dizia "papel alterado" toda vez que alguém corrigisse
   * apenas o nome. Um histórico que aponta mudanças que não aconteceram é
   * pior do que não ter histórico: leva quem investiga para o lado errado.
   */
  function anotarSeMudou(campo: string, novo: unknown, atual: unknown) {
    if (novo !== atual) camposAlterados.push(campo);
  }

  if (body.nome !== undefined) {
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    if (!nome) return NextResponse.json({ error: "O nome não pode ficar vazio." }, { status: 400 });
    if (nome.length > NOME_MAX) {
      return NextResponse.json({ error: `O nome deve ter no máximo ${NOME_MAX} caracteres.` }, { status: 400 });
    }
    data.nome = nome;
    anotarSeMudou("nome", nome, alvo.nome);
  }

  if (body.setor !== undefined) {
    const setor = typeof body.setor === "string" && body.setor.trim() ? body.setor.trim() : null;
    if (setor && setor.length > SETOR_MAX) {
      return NextResponse.json({ error: `O setor deve ter no máximo ${SETOR_MAX} caracteres.` }, { status: 400 });
    }
    data.setor = setor;
    anotarSeMudou("setor", setor, alvo.setor);
  }

  if (body.papel !== undefined) {
    if (typeof body.papel !== "string" || !PAPEIS_VALIDOS.includes(body.papel)) {
      return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
    }
    // Um admin não pode se rebaixar. Se for o último, o sistema fica sem
    // ninguém capaz de gerenciar contas e mover a fila de produção, e só um
    // acesso direto ao banco destravaria.
    if (alvo.id === sessao.id && body.papel !== Papel.admin) {
      return NextResponse.json(
        { error: "Você não pode remover o próprio perfil de administrador." },
        { status: 400 }
      );
    }
    data.papel = body.papel as Papel;
    anotarSeMudou("papel", body.papel, alvo.papel);
  }

  if (body.gerenciaAcessos !== undefined) {
    if (typeof body.gerenciaAcessos !== "boolean") {
      return NextResponse.json(
        { error: "O campo 'gerenciaAcessos' deve ser verdadeiro ou falso." },
        { status: 400 }
      );
    }
    // Tirar a própria permissão tranca a porta por dentro: a pessoa perde o
    // acesso à tela no clique seguinte e, se for a única com a permissão,
    // ninguém mais consegue devolvê-la sem mexer no banco.
    if (alvo.id === sessao.id && body.gerenciaAcessos === false) {
      return NextResponse.json(
        { error: "Você não pode remover a própria permissão de gerenciar acessos." },
        { status: 400 }
      );
    }
    // Quem gerencia acessos precisa antes enxergar a operação inteira.
    const papelFinal = (data.papel as Papel | undefined) ?? alvo.papel;
    if (body.gerenciaAcessos === true && papelFinal !== Papel.admin) {
      return NextResponse.json(
        { error: "Só uma conta com perfil Admin pode gerenciar acessos." },
        { status: 400 }
      );
    }
    data.gerenciaAcessos = body.gerenciaAcessos;
    anotarSeMudou("gerenciaAcessos", body.gerenciaAcessos, alvo.gerenciaAcessos);
  }

  // Rebaixar para colaborador tem de levar a permissão junto — senão sobraria
  // um colaborador capaz de criar contas de admin.
  if (data.papel === Papel.colaborador && alvo.gerenciaAcessos) {
    data.gerenciaAcessos = false;
    if (!camposAlterados.includes("gerenciaAcessos")) camposAlterados.push("gerenciaAcessos");
  }

  if (body.ativo !== undefined) {
    if (typeof body.ativo !== "boolean") {
      return NextResponse.json({ error: "O campo 'ativo' deve ser verdadeiro ou falso." }, { status: 400 });
    }
    // Mesmo motivo do bloqueio acima: desativar a si mesmo tranca o admin
    // para fora na hora seguinte (getUsuarioSessao recusa conta inativa).
    if (alvo.id === sessao.id && body.ativo === false) {
      return NextResponse.json({ error: "Você não pode desativar a própria conta." }, { status: 400 });
    }
    data.ativo = body.ativo;
    // Situação é a exceção: "reativação"/"desativação" são eventos, e só
    // entram no log quando o valor de fato virou.
    if (body.ativo !== alvo.ativo) {
      camposAlterados.push(body.ativo ? "reativação" : "desativação");
    }
  }

  if (body.senha !== undefined) {
    const senha = typeof body.senha === "string" ? body.senha : "";
    if (!senha) return NextResponse.json({ error: "Informe a nova senha." }, { status: 400 });
    if (senha.length < SENHA_MIN) return NextResponse.json({ error: SENHA_MSG }, { status: 400 });
    if (senha.length > SENHA_MAX) {
      return NextResponse.json({ error: "A senha excede o tamanho máximo." }, { status: 400 });
    }
    data.senhaHash = await hashSenha(senha);
    camposAlterados.push("senha");
  }

  // Salvar sem ter mudado nada não é erro — é um clique a mais. Devolve a
  // conta como está, sem escrever no banco e sem poluir a auditoria com uma
  // linha de "editou" que não editou coisa alguma.
  if (camposAlterados.length === 0) {
    return NextResponse.json({
      id: alvo.id,
      nome: alvo.nome,
      email: alvo.email,
      papel: alvo.papel,
      ativo: alvo.ativo,
      setor: alvo.setor,
      gerenciaAcessos: alvo.gerenciaAcessos,
    });
  }

  try {
    const usuario = await prisma.usuario.update({ where: { id: params.id }, data });
    // O log registra QUAIS campos mudaram — nunca o valor da senha nem o hash.
    await registrarLog("editar", "usuarios", usuario.id, sessao.id, {
      email: usuario.email,
      campos: camposAlterados,
    });
    return NextResponse.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      ativo: usuario.ativo,
      setor: usuario.setor,
      gerenciaAcessos: usuario.gerenciaAcessos,
    });
  } catch (erro) {
    console.error("[PATCH /api/usuarios/[id]]", erro);
    return NextResponse.json({ error: "Não foi possível salvar as alterações." }, { status: 500 });
  }
}
