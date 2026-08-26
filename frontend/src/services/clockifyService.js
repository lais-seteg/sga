/**
 * SGA SETEG - Sistema de Solicitação de Peças Gráficas
 * Ano: 2026
 * Empresa: SETEG
 *
 * Integração com o Clockify — alimenta o autocomplete do campo
 * "Código do Projeto | Cliente" com os projetos ativos do workspace.
 *
 * Os projetos servem a UMA coisa: esse autocomplete, dentro do formulário.
 * Antes eram buscados no DOMContentLoaded — três requisições externas e
 * ~200 KB que a maioria de quem abre a página nunca usa.
 *
 * Agora a busca é sob demanda e acontece no máximo uma vez por sessão:
 * garantirProjetosClockify() guarda a promessa e devolve sempre a mesma.
 * Quem chama são o botão "Nova Solicitação" (para já estar pronto quando a
 * pessoa começar a digitar) e o próprio autocomplete.
 */

const CLOCKIFY_API_KEY = import.meta.env.VITE_CLOCKIFY_API_KEY;
const CLOCKIFY_BASE_URL = "https://api.clockify.me/api/v1";

let projetosClockify = [];
let _clockifyPromise = null;

export function listaProjetosClockify() {
  return projetosClockify;
}

export function garantirProjetosClockify() {
  if (!_clockifyPromise) _clockifyPromise = carregarProjetosClockify();
  return _clockifyPromise;
}

async function carregarProjetosClockify() {
  if (!CLOCKIFY_API_KEY) {
    console.warn("VITE_CLOCKIFY_API_KEY não configurada — autocomplete de projeto desativado.");
    return;
  }
  try {
    const wsRes = await fetch(`${CLOCKIFY_BASE_URL}/workspaces`, {
      headers: { "X-Api-Key": CLOCKIFY_API_KEY },
    });
    if (!wsRes.ok) throw new Error(`Erro workspace: ${wsRes.status}`);
    const workspaces = await wsRes.json();
    if (!workspaces.length) throw new Error("Nenhum workspace encontrado");
    const wsId = workspaces[0].id;

    const todos = [];
    for (let page = 1; page < 100; page++) {
      const res = await fetch(
        `${CLOCKIFY_BASE_URL}/workspaces/${wsId}/projects?page=${page}&page-size=200&archived=false`,
        { headers: { "X-Api-Key": CLOCKIFY_API_KEY } }
      );
      if (!res.ok) throw new Error(`Erro projetos: ${res.status}`);
      const lote = await res.json();
      if (!lote.length) break;
      todos.push(...lote);
      if (lote.length < 200) break;
    }

    const ignorar = /^(CANCELADO|FINALIZADO)/i;
    projetosClockify = todos
      .filter((p) => !ignorar.test((p.name || "").trim()))
      .map((p) => {
        const m = (p.name || "").match(/^(#[^\s(]+)\s*(?:\((.+)\))?$/);
        const code = m ? m[1] : p.name;
        const nome =
          (m && m[2] ? m[2].trim() : null) ||
          (p.clientName ? p.clientName.trim() : null) ||
          p.name;
        return { ...p, _code: code, _nome: nome };
      });
    console.log(`✅ ${projetosClockify.length} projetos Clockify carregados`);
  } catch (e) {
    console.error("❌ Erro ao carregar projetos Clockify:", e);
  }
}

function normalizarTexto(str) {
  return (str || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function filtrarProjetosClockify(texto) {
  const t = normalizarTexto(texto);
  if (t.length < 2) return [];
  return projetosClockify
    .filter(
      (p) =>
        normalizarTexto(p._nome).includes(t) ||
        normalizarTexto(p._code).includes(t) ||
        normalizarTexto(p.clientName || "").includes(t) ||
        normalizarTexto(p.name).includes(t)
    )
    .slice(0, 12);
}
