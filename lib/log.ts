import { prisma } from "@/lib/prisma";

/**
 * Auditoria em `system_logs` — criação, mudança de status e exclusão.
 *
 * Gravação sempre "melhor esforço": se o log falhar, a ação que o originou
 * NÃO pode falhar junto. Um pedido salvo com sucesso não vira erro na tela
 * porque a linha de auditoria não entrou. Por isso o catch engole a exceção e
 * apenas registra no console do servidor.
 */
export async function registrarLog(
  acao: string,
  entidade: string,
  entidadeId: string | null,
  usuarioId: string | null,
  dados: Record<string, unknown> = {}
): Promise<void> {
  try {
    await prisma.systemLog.create({
      data: { acao, entidade, entidadeId, usuarioId, dados: dados as object },
    });
  } catch (erro) {
    console.warn("[log] não foi possível registrar a auditoria:", erro);
  }
}
