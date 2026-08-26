/**
 * SGA SETEG - Sistema de Solicitação de Peças Gráficas
 * Ano: 2026
 * Empresa: SETEG
 *
 * Cliente Supabase — instância única compartilhada em toda a aplicação.
 *
 * Além da URL e da chave publishable, o cliente envia o token de sessão
 * (X-SGA-Token) em toda requisição. É esse token que dá identidade ao
 * usuário no banco: as policies de UPDATE e DELETE da tabela `solicitacoes`
 * chamam sga_role_atual(), que lê justamente esse cabeçalho. Sem token,
 * ninguém altera nem exclui nada — a checagem deixou de ser só de tela.
 *
 * Como a instância é única, o token é injetado por um fetch personalizado
 * que lê o valor atual a cada chamada — assim o login não precisa recriar
 * o cliente.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const SGA_TOKEN_KEY = "sga_token";

export function sgaGetToken() {
  try {
    return localStorage.getItem(SGA_TOKEN_KEY) || "";
  } catch (e) {
    return "";
  }
}

export function sgaSetToken(token) {
  try {
    if (token) localStorage.setItem(SGA_TOKEN_KEY, token);
    else localStorage.removeItem(SGA_TOKEN_KEY);
  } catch (e) {
    /* storage indisponível */
  }
}

// fetch que acrescenta o token atual em cada requisição, sem recriar o
// cliente. Lê o valor na hora da chamada, então o login (que grava o token)
// passa a valer imediatamente para as requisições seguintes.
function fetchComToken(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = sgaGetToken();
  if (token) headers.set("X-SGA-Token", token);
  return fetch(url, { ...options, headers });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchComToken },
});
