/**
 * SGA SETEG - Sistema de Solicitação de Peças Gráficas
 * Ano: 2026
 * Empresa: SETEG
 *
 * Serviço de usuários — autenticação por código de acesso.
 *
 * A validação acontece NO BANCO, pela RPC login_sga (SECURITY DEFINER), que
 * compara o código contra o hash bcrypt e devolve um token de sessão válido
 * por 12 horas. A tabela `usuarios` não é legível pelo cliente — o código de
 * acesso nunca sai do servidor, e o que volta é só nome, papel e token.
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
 * Apaga qualquer token que tenha sobrado de uma visita anterior.
 *
 * A página continua abrindo deslogada, como sempre abriu: quem gerencia
 * digita o código a cada visita. Sem esta limpeza, o token ficaria no
 * localStorage valendo por 12 horas enquanto a tela mostra "Gestor" como
 * botão de entrar — sessão viva sem ninguém logado na interface.
 */
export function limparSessaoResidual() {
  sgaSetToken(null);
}
