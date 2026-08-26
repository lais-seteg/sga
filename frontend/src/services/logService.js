/**
 * SGA SETEG - Sistema de Solicitação de Peças Gráficas
 * Ano: 2026
 * Empresa: SETEG
 *
 * Serviço de auditoria — registra logs de ações no banco.
 *
 * A gravação é sempre "melhor esforço": se o log falhar, a ação que o
 * originou não pode falhar junto. Por isso o erro só vira aviso no console.
 */

import { supabase } from "./supabaseClient.js";

export async function registrarLog(acao, entidade, entidadeId, dados = {}) {
  try {
    await supabase.from("system_logs").insert({
      acao: acao,
      entidade: entidade,
      entidade_id: entidadeId,
      dados: dados,
    });
  } catch (erro) {
    console.warn("Erro ao registrar log:", erro);
  }
}
