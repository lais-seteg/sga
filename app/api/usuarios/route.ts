import { NextRequest, NextResponse } from "next/server";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUsuarioSessao } from "@/lib/session";
import { hashSenha } from "@/lib/auth";
import { registrarLog } from "@/lib/log";
import { SETOR_MAX } from "@/lib/solicitacaoListas";
import { EMAIL_RE, NOME_MAX, SENHA_MIN, SENHA_MSG } from "@/lib/politicaConta";

export const dynamic = "force-dynamic";

const PAPEIS_VALIDOS = Object.values(Papel) as string[];

/**
 * POST /api/usuarios — cria uma conta. Exclusivo de admin.
 *
 * O middleware já barra /api/usuarios para quem não é admin; a checagem se
 * repete aqui com o banco, que é a fonte autoritativa do papel (o token
 * pode ter sido emitido antes de um rebaixamento).
 */
export async function POST(request: NextRequest) {
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

  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const senha = typeof body.senha === "string" ? body.senha : "";
  const setor = typeof body.setor === "string" && body.setor.trim() ? body.setor.trim() : null;

  if (!nome) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  if (nome.length > NOME_MAX) {
    return NextResponse.json({ error: `O nome deve ter no máximo ${NOME_MAX} caracteres.` }, { status: 400 });
  }
  if (!email) return NextResponse.json({ error: "Informe o e-mail." }, { status: 400 });
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "E-mail em formato inválido." }, { status: 400 });
  }
  if (!senha) return NextResponse.json({ error: "Informe a senha." }, { status: 400 });
  if (senha.length < SENHA_MIN) return NextResponse.json({ error: SENHA_MSG }, { status: 400 });
  if (setor && setor.length > SETOR_MAX) {
    return NextResponse.json({ error: `O setor deve ter no máximo ${SETOR_MAX} caracteres.` }, { status: 400 });
  }

  if (typeof body.papel !== "string" || !PAPEIS_VALIDOS.includes(body.papel)) {
    return NextResponse.json(
      { error: `Perfil inválido. Use um de: ${PAPEIS_VALIDOS.join(", ")}.` },
      { status: 400 }
    );
  }
  const papel = body.papel as Papel;

  try {
    const usuario = await prisma.usuario.create({
      data: { nome, email, senhaHash: await hashSenha(senha), papel, setor },
    });
    await registrarLog("criar", "usuarios", usuario.id, sessao.id, { email: usuario.email, papel });
    // A senha e o hash dela nunca voltam na resposta.
    return NextResponse.json(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
      { status: 201 }
    );
  } catch (erro) {
    // P2002 = violação de unique. O único unique de Usuario é o e-mail.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return NextResponse.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
    }
    console.error("[POST /api/usuarios]", erro);
    return NextResponse.json({ error: "Não foi possível cadastrar a conta." }, { status: 500 });
  }
}
