// Middleware do Next.js — o porteiro leve de autenticação e autorização.
//
// Ele roda em Edge Runtime e NÃO consulta o banco: só confere a assinatura do
// cookie de sessão. É a primeira barreira, não a última. Cada página e cada
// rota de API repetem a checagem de verdade via lib/session.ts
// (requireUsuario / requireRole / podeVerTudo), que lê o banco e sabe se a
// pessoa foi desativada ou rebaixada depois que o token foi emitido.

import { NextRequest, NextResponse } from "next/server";
import { Papel } from "@prisma/client";
import { getUsuarioSessaoFromRequest } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/token";

// Comparação exata, e não startsWith: nenhuma destas tem sub-rota, e
// startsWith abriria brecha para "/login-qualquer-coisa" ou
// "/api/auth/loginX" passarem como rota pública.
const ROTAS_PUBLICAS = ["/login", "/api/auth/login", "/api/auth/logout"];

const ROTAS_RESTRITAS: { prefixo: string; papeis: Papel[] }[] = [
  // Indicadores de produtividade da equipe de produção.
  { prefixo: "/dashboard", papeis: [Papel.admin] },
];

/** Rotas que exigem a permissão `gerenciaAcessos`, que é separada do papel —
 *  ver Usuario.gerenciaAcessos no schema. */
const ROTAS_GESTAO_DE_ACESSOS = ["/usuarios", "/api/usuarios"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ROTAS_PUBLICAS.includes(pathname)) {
    // `?sessao=invalida` significa que a página mandou para cá porque o BANCO
    // (que o middleware não consulta) rejeitou o cookie. Sem este desvio, o
    // middleware veria a mesma assinatura como válida e devolveria a pessoa
    // para /solicitacoes — laço infinito entre as duas rotas.
    if (pathname === "/login" && !request.nextUrl.searchParams.has("sessao")) {
      const usuarioLogado = await getUsuarioSessaoFromRequest(request);
      if (usuarioLogado) {
        return NextResponse.redirect(new URL("/solicitacoes", request.url));
      }
    }
    return NextResponse.next();
  }

  const usuario = await getUsuarioSessaoFromRequest(request);
  if (!usuario) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    // Cookie presente mas recusado (assinatura inválida, expirado, corrompido)
    // é diferente de nunca ter entrado: havia uma sessão, então a tela de
    // login explica "sua sessão expirou" em vez de abrir em branco.
    const haviaCookie = Boolean(request.cookies.get(SESSION_COOKIE));
    return NextResponse.redirect(
      new URL(haviaCookie ? "/login?sessao=invalida" : "/login", request.url)
    );
  }

  const negar = () =>
    pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Acesso negado" }, { status: 403 })
      : NextResponse.redirect(new URL("/solicitacoes", request.url));

  const restricao = ROTAS_RESTRITAS.find((r) => pathname.startsWith(r.prefixo));
  if (restricao && !restricao.papeis.includes(usuario.papel)) {
    return negar();
  }

  // `gerenciaAcessos` vem do token, que pode ter sido emitido antes de a
  // permissão ser retirada. Por isso a tela e a rota de API conferem de novo
  // no banco (requireGestaoDeAcessos / getUsuarioSessao) — aqui é só a
  // primeira barreira, para não renderizar a página à toa.
  if (ROTAS_GESTAO_DE_ACESSOS.some((p) => pathname.startsWith(p)) && !usuario.gerenciaAcessos) {
    return negar();
  }

  return NextResponse.next();
}

export const config = {
  // Tudo passa pelo middleware, menos o que o navegador busca sozinho
  // (chunks do Next, fontes, imagens) — rodar o porteiro em cada .woff2 só
  // gastaria invocação.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2)$).*)",
  ],
};
