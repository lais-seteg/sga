import { prisma } from "@/lib/prisma";

/**
 * Gera o próximo protocolo (SOL-0152, SOL-0153...).
 *
 * Usa `public.solicitacoes_id_seq`, a MESMA sequence que a versão anterior do
 * sistema já usava (via o trigger `generate_protocolo_trigger`). Reaproveitar
 * o contador em vez de começar um novo é o que mantém a numeração contínua
 * com os 136 pedidos históricos — inventar um formato novo faria SOL-0151 ser
 * seguido de "SGA-2026-0001", e ninguém conseguiria ordenar a lista de
 * pedidos de cabeça.
 *
 * Por que uma sequence e não `count(*) + 1`: contar linhas está sujeito a
 * corrida — dois pedidos salvos no mesmo instante receberiam o mesmo número e
 * o segundo quebraria no unique de `protocolo`. `nextval` é atômico por
 * definição e não precisa de transação.
 */
export async function gerarProtocolo(): Promise<string> {
  const linhas = await prisma.$queryRaw<{ valor: bigint }[]>`
    SELECT nextval('public.solicitacoes_id_seq') AS valor
  `;
  const numero = Number(linhas[0].valor);
  return `SOL-${String(numero).padStart(4, "0")}`;
}
