/**
 * SGA SETEG - Sistema de Solicitação de Peças Gráficas
 * Ano: 2026
 * Empresa: SETEG
 *
 * Serviço de usuários — autenticação por código de acesso.
 *
 * A validação acontece NO BANCO, pela RPC login_sga (SECURITY DEFINER), que
 * compara o código contra o hash bcrypt e devolve um token de sessão. A
 * tabela `usuarios` não é legível pelo cliente — o código de acesso nunca
 * sai do servidor, e o que volta é só nome, papel e token.
 */

import { supabase, sgaSetToken, sgaGetToken } from "../../services/supabaseClient.js";

export async function autenticarUsuario(codigoDigitado) {
  const codigo = (codigoDigitado || "").trim();
  if (!codigo) {
    return { sucesso: false, mensagem: "Digite o código." };
  }

  try {
    const { data, error } = await supabase.rpc("login_sga", { p_codigo: codigo });
    if (error) {
      console.error("Erro ao autenticar:", error);
      return { sucesso: false, mensagem: "Erro ao verificar acesso." };
    }
    if (!data || data.ok !== true || !data.token) {
      return { sucesso: false, mensagem: "Código incorreto." };
    }

    // Guarda o token: é ele que dá identidade nas próximas requisições e o
    // que as policies de UPDATE/DELETE conferem.
    sgaSetToken(data.token);

    // O código de acesso NUNCA volta.
    return {
      sucesso: true,
      usuario: { nome: data.nome, role: data.role },
    };
  } catch (e) {
    console.error("Falha na autenticação:", e);
    return { sucesso: false, mensagem: "Erro de conexão." };
  }
}

/**
 * Derruba a sessão no banco e apaga o token local. Se a chamada ao banco
 * falhar, o token local sai do mesmo jeito — quem clicou em "Sair" tem que
 * sair da interface de qualquer maneira.
 */
export async function encerrarSessao() {
  const token = sgaGetToken();
  sgaSetToken(null);
  if (!token) return;
  try {
    await supabase.rpc("logout_sga", { p_token: token });
  } catch (e) {
    console.warn("Erro ao encerrar sessão no banco:", e);
  }
}

/**
 * Recupera a sessão guardada no dispositivo, para quem gerencia não precisar
 * digitar o código a cada visita.
 *
 * Quem decide se o token vale é o banco, pela RPC sessao_atual: ela confere
 * o cabeçalho X-SGA-Token, recusa usuário desativado e renova o prazo a
 * cada uso. O cliente não tem voto nisso — só guarda o token e pergunta.
 *
 * Devolve { nome, role } quando a sessão vale, ou null. Em qualquer falha —
 * token expirado, sem rede, ou a RPC ainda não existindo no banco — o token
 * local é descartado e a página segue deslogada, exatamente como se
 * comportava antes desta função existir. É o que garante que uma falha aqui
 * nunca bloqueie o acesso: no pior caso, pede o código.
 */
export async function restaurarSessao() {
  if (!sgaGetToken()) return null;
  try {
    const { data, error } = await supabase.rpc("sessao_atual");
    if (error || !data || data.ok !== true) {
      sgaSetToken(null);
      return null;
    }
    return { nome: data.nome, role: data.role };
  } catch (e) {
    console.warn("Não foi possível restaurar a sessão:", e);
    sgaSetToken(null);
    return null;
  }
}
