/**
 * SGA SETEG - Sistema de Solicitação de Peças Gráficas
 * Ano: 2026
 * Empresa: SETEG
 *
 * Serviço de solicitações — todo o acesso à tabela `solicitacoes` passa por
 * aqui. A camada de tela (app.js) não fala com o Supabase direto.
 *
 * Quem manda nas permissões é o banco, não este arquivo:
 *   listar / criar  -> abertos (a tabela é pública e o formulário também)
 *   atualizar / excluir -> exigem sessão de gestor, conferida pela policy
 *                          via o cabeçalho X-SGA-Token
 * Sem token válido, o PostgREST devolve zero linha afetada — por isso as
 * funções abaixo tratam "nenhuma linha" como falha de permissão.
 */

import { supabase } from "../../services/supabaseClient.js";
import { registrarLog } from "../../services/logService.js";

export async function listarSolicitacoes() {
  const { data, error } = await supabase
    .from("solicitacoes")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function criarSolicitacao(payload) {
  const { data, error } = await supabase.from("solicitacoes").insert([payload]).select();
  if (error) throw error;
  const criada = data?.[0] || null;
  if (criada) {
    registrarLog("criar", "solicitacoes", criada.id, {
      protocolo: criada.protocolo,
      setor: criada.solicitante_setor,
    });
  }
  return criada;
}

export async function atualizarStatus(id, novoStatus) {
  const { data, error } = await supabase
    .from("solicitacoes")
    .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select();
  if (error) throw error;
  // Zero linha com sucesso = a policy barrou. É o caso de sessão expirada.
  if (!data || data.length === 0) {
    throw new Error("Sem permissão para alterar. Entre novamente como gestor.");
  }
  registrarLog("mudar_status", "solicitacoes", id, { status: novoStatus });
  return data[0];
}

export async function excluirSolicitacao(id) {
  const { data, error } = await supabase
    .from("solicitacoes")
    .delete()
    .eq("id", id)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Sem permissão para excluir. Entre novamente como gestor.");
  }
  registrarLog("excluir", "solicitacoes", id, {});
  return data[0];
}
