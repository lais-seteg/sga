import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { Papel } from "@prisma/client";
// Importa direto de lib/token.ts, e não de lib/auth.ts, para que este módulo
// — usado pelo middleware — nunca arraste o bcryptjs para o bundle de Edge.
import { SESSION_COOKIE, SessionTokenPayload, verificarToken } from "@/lib/token";
// lib/prisma só pode ser importado aqui, jamais dentro de
// getUsuarioSessaoFromRequest: aquela variante roda no middleware (Edge
// Runtime), que não suporta a conexão Postgres do Prisma.
import { prisma } from "@/lib/prisma";

/**
 * Lê o usuário logado a partir do cookie de sessão (Server Components e route
 * handlers) e revalida a conta no banco a cada chamada.
 *
 * A revalidação existe porque o JWT é imutável até expirar. Sem ela, alguém
 * desativado na tela /usuarios continuaria entrando e escrevendo por até 12
 * horas. `papel` também vem do banco, e não do token: se um admin rebaixar
 * alguém a colaborador, o efeito precisa ser imediato, não no próximo login.
 */
export async function getUsuarioSessao(): Promise<SessionTokenPayload | null> {
  const cookie = cookies().get(SESSION_COOKIE);
  if (!cookie) return null;
  const usuario = await verificarToken(cookie.value);
  if (!usuario) return null;

  const usuarioDb = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { ativo: true, papel: true, nome: true, gerenciaAcessos: true },
  });
  if (!usuarioDb || !usuarioDb.ativo) return null;

  return {
    ...usuario,
    papel: usuarioDb.papel,
    nome: usuarioDb.nome,
    gerenciaAcessos: usuarioDb.gerenciaAcessos,
  };
}

/**
 * Variante para uso dentro do middleware, que recebe o NextRequest direto.
 * Só confere a assinatura do JWT — a checagem autoritativa, com banco, é a
 * getUsuarioSessao acima.
 */
export async function getUsuarioSessaoFromRequest(
  request: NextRequest
): Promise<SessionTokenPayload | null> {
  const cookie = request.cookies.get(SESSION_COOKIE);
  if (!cookie) return null;
  return verificarToken(cookie.value);
}

/**
 * Garante que existe uma sessão válida, sem olhar o papel.
 *
 * O `?sessao=invalida` no redirect quebra um laço real: o middleware (Edge,
 * sem acesso ao banco) só confere a assinatura, então um cookie bem assinado
 * de uma conta desativada passa por ele; só aqui a sessão é rejeitada. Sem o
 * parâmetro, o middleware veria o mesmo cookie como "válido" ao receber
 * /login e mandaria de volta para /solicitacoes — ping-pong infinito entre as
 * duas rotas. Com ele, o middleware deixa a tela de login renderizar, e ela
 * mesma limpa o cookie (ver app/login/page.tsx).
 */
export async function requireUsuario(): Promise<SessionTokenPayload> {
  const usuario = await getUsuarioSessao();
  if (!usuario) {
    redirect("/login?sessao=invalida");
  }
  return usuario;
}

/**
 * Garante que o usuário logado tem um dos papéis permitidos. Checagem
 * autoritativa: repete, com banco, a que o middleware faz só pelo token.
 */
export async function requireRole(papeis: Papel[]): Promise<SessionTokenPayload> {
  const usuario = await requireUsuario();
  if (!papeis.includes(usuario.papel)) {
    redirect("/solicitacoes");
  }
  return usuario;
}

/**
 * Garante que a pessoa pode mexer em contas de acesso (tela /usuarios).
 *
 * Separado de `requireRole([admin])` de propósito: as duas admin da produção
 * enxergam tudo e movem a fila, mas só quem tem `gerenciaAcessos` cria conta,
 * troca senha e desativa gente.
 */
export async function requireGestaoDeAcessos(): Promise<SessionTokenPayload> {
  const usuario = await requireUsuario();
  if (!usuario.gerenciaAcessos) {
    redirect("/solicitacoes");
  }
  return usuario;
}

/**
 * True para quem enxerga e opera TODAS as solicitações.
 *
 * Um único ponto de verdade para a regra "cada solicitante só vê as suas" —
 * usado tanto pela página quanto pelas rotas de API. Espalhar
 * `papel === admin` por dez arquivos é como essa regra silenciosamente deixa
 * de valer num deles.
 */
export function podeVerTudo(usuario: SessionTokenPayload): boolean {
  return usuario.papel === Papel.admin;
}
