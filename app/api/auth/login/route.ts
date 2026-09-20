import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assinarToken, compararSenha, SESSION_COOKIE, SESSION_MAX_AGE_SEGUNDOS } from "@/lib/auth";
import { obterIpCliente, registrarFalha, registrarSucesso, verificarLimite } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Registra um evento de segurança em `system_logs`.
 *
 * Antes isto só ia para `console.warn`. Log de console na Vercel tem
 * retenção curta e ninguém abre o painel para procurar — na prática, um
 * ataque de força bruta passaria despercebido. Gravado na mesma tabela de
 * auditoria do resto, vira algo que dá para consultar com SQL depois
 * ("quantas tentativas falharam esta semana, e de onde").
 *
 * Nunca grava a senha, nem certa nem errada. `usuarioId` fica nulo: quem
 * falhou o login não tem sessão, e o e-mail pode nem existir.
 *
 * Melhor esforço, como o resto da auditoria: uma falha aqui não pode
 * derrubar o login.
 */
async function registrarEventoSeguranca(
  acao: string,
  ip: string,
  email: string,
  motivo?: string
): Promise<void> {
  console.warn(`[SECURITY] ${acao} ip=${ip} email=${email}${motivo ? ` motivo=${motivo}` : ""}`);
  try {
    await prisma.systemLog.create({
      data: {
        acao,
        entidade: "auth",
        entidadeId: null,
        usuarioId: null,
        dados: { ip, email, ...(motivo ? { motivo } : {}) },
      },
    });
  } catch (erro) {
    console.warn("[SECURITY] não foi possível gravar o evento:", erro);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const { email, senha } = (body as { email?: unknown; senha?: unknown }) ?? {};

  // Tipo e tamanho ANTES de qualquer outra coisa: um corpo malformado (não
  // string, ou uma string gigante) só estouraria mais adiante, no bcrypt ou
  // no Prisma, depois de já ter dado trabalho. 254 é o limite prático de
  // e-mail (RFC 5321); 200 é folga para a senha — o bcrypt trunca em 72 bytes
  // de qualquer jeito, isto aqui só rejeita payload absurdo cedo.
  if (typeof email !== "string" || typeof senha !== "string" || !email || !senha) {
    return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }
  if (email.length > 254 || senha.length > 200) {
    return NextResponse.json({ error: "E-mail ou senha excede o tamanho máximo." }, { status: 400 });
  }

  // O cadastro grava o e-mail em minúsculas, mas o findUnique é
  // case-sensitive: sem normalizar aqui, quem digitasse "Eveline@setegce.com"
  // — ou tivesse o autocapitalize do celular atrapalhando — receberia
  // "credenciais inválidas" com a senha correta.
  const emailNormalizado = email.trim().toLowerCase();

  // Freio de força bruta por IP + e-mail. Ver lib/rateLimit.ts para as
  // limitações assumidas (contador em memória do processo, sem Redis).
  const ip = obterIpCliente(request);
  const limite = await verificarLimite(ip, emailNormalizado);
  if (limite.bloqueado) {
    // Log estruturado, fácil de encontrar com grep: bloqueio de rate limit é
    // o sinal mais forte de tentativa de força bruta — o próprio app já
    // decidiu que aquele par IP/e-mail passou do limite.
    await registrarEventoSeguranca("login_bloqueado", ip, emailNormalizado);
    return NextResponse.json(
      {
        error: `Muitas tentativas com credenciais inválidas. Tente novamente em ${limite.segundosRestantes} segundos.`,
      },
      { status: 429 }
    );
  }

  // A consulta vai num try próprio porque banco indisponível NÃO é
  // credencial errada. Sem isto, o Prisma estoura, a rota devolve 500 sem
  // corpo, e a tela de login cai no texto padrão "E-mail ou senha
  // incorretos." — ou seja, culpa a pessoa por uma falha de infraestrutura e
  // a faz tentar a senha de novo. Erro real, observado com o .env apontando
  // para um banco inalcançável.
  let usuario;
  try {
    usuario = await prisma.usuario.findUnique({ where: { email: emailNormalizado } });
  } catch (erro) {
    console.error("[POST /api/auth/login] banco indisponível:", erro);
    return NextResponse.json(
      { error: "O sistema não conseguiu falar com o banco de dados. Tente de novo em instantes." },
      { status: 503 }
    );
  }

  // Mesma mensagem e mesmo status para "não existe", "conta inativa" e "senha
  // errada". Diferenciar entregaria a quem tenta adivinhar a informação de
  // quais e-mails têm conta no sistema.
  if (!usuario || !usuario.ativo) {
    await registrarFalha(ip, emailNormalizado);
    await registrarEventoSeguranca(
      "login_falhou",
      ip,
      emailNormalizado,
      usuario ? "conta_inativa" : "email_inexistente"
    );
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  const senhaOk = await compararSenha(senha, usuario.senhaHash);
  if (!senhaOk) {
    await registrarFalha(ip, emailNormalizado);
    await registrarEventoSeguranca("login_falhou", ip, emailNormalizado, "senha_incorreta");
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  await registrarSucesso(ip, emailNormalizado);

  // "Último acesso" é informação de apoio da tela /usuarios. Falhar aqui não
  // pode impedir um login que já foi validado.
  try {
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcessoEm: new Date() },
    });
  } catch (erro) {
    console.warn("[POST /api/auth/login] não foi possível registrar o último acesso:", erro);
  }

  const token = await assinarToken({
    id: usuario.id,
    email: usuario.email,
    papel: usuario.papel,
    nome: usuario.nome,
    gerenciaAcessos: usuario.gerenciaAcessos,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    // httpOnly: o JavaScript da página não lê este cookie, então um XSS não
    // consegue roubar a sessão. Era exatamente o que o token no localStorage
    // da versão anterior permitia.
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEGUNDOS,
  });
  return response;
}
