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

// As variáveis VITE_ são embutidas no bundle durante o build. Se faltarem
// (o caso clássico: .env existe na máquina, mas ninguém cadastrou as
// variáveis no Vercel), o createClient abaixo estoura na carga do módulo e
// derruba o app.js inteiro — a tela fica em branco, sem tabela e sem erro
// visível, como se os dados tivessem sumido. Já aconteceu.
//
// Então avisamos na tela antes de deixar quebrar: o problema é de
// configuração do deploy, não de dado perdido, e a mensagem precisa dizer
// isso para quem estiver olhando.
const faltando = [];
if (!supabaseUrl) faltando.push("VITE_SUPABASE_URL");
if (!supabaseAnonKey) faltando.push("VITE_SUPABASE_ANON_KEY");

function avisarConfiguracaoAusente(variaveis) {
  const desenhar = () => {
    const aviso = document.createElement("div");
    aviso.setAttribute("role", "alert");
    aviso.style.cssText =
      "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;" +
      "justify-content:center;padding:24px;background:#1c1917;color:#fafaf9;" +
      "font-family:system-ui,sans-serif;line-height:1.6;text-align:center";
    aviso.innerHTML =
      '<div style="max-width:560px">' +
      '<h1 style="font-size:20px;margin:0 0 12px">Configuração ausente</h1>' +
      "<p style=\"margin:0 0 12px\">O site subiu sem as variáveis de ambiente do Supabase, " +
      "então não consegue conversar com o banco.</p>" +
      '<p style="margin:0 0 12px">Faltando: <code style="background:#292524;padding:2px 6px;' +
      'border-radius:4px">' +
      variaveis.join("</code>, <code style=\"background:#292524;padding:2px 6px;border-radius:4px\">") +
      "</code></p>" +
      '<p style="margin:0;opacity:.75;font-size:14px">Nenhuma solicitação foi perdida — os dados ' +
      "continuam no banco. Cadastre as variáveis em Vercel → Settings → Environment Variables " +
      "e refaça o deploy.</p>" +
      "</div>";
    document.body.appendChild(aviso);
  };
  if (document.body) desenhar();
  else document.addEventListener("DOMContentLoaded", desenhar);
}

if (faltando.length) {
  avisarConfiguracaoAusente(faltando);
  throw new Error(
    "Supabase não configurado. Variáveis ausentes: " +
      faltando.join(", ") +
      ". Veja frontend/.env.example."
  );
}

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
