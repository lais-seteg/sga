import { prisma } from "@/lib/prisma";

// Projetos que alimentam o autocomplete de "Código do Projeto | Cliente".
//
// Substitui a integração com o Clockify, que deixou de ser usada pela Seteg.
// A fonte agora é a planilha CLIENTES_ATIVOS, mantida pelo PMO e espelhada na
// tabela `projetos` por `npm run importar:projetos`.
//
// A troca também simplificou a vida do formulário: em vez de uma chamada HTTP
// a um serviço externo (que podia estar lento ou fora do ar, e por isso
// precisava de cache, timeout e um estado de "carregando" na tela), é uma
// consulta ao mesmo banco de onde já vem o resto da página.

export interface ProjetoOpcao {
  /** Código sem "#", como fica gravado na solicitação: '0189-3-2025'. */
  codigo: string;
  cliente: string;
  /** Nome do projeto. Pode faltar em linha incompleta da planilha. */
  projeto: string | null;
}

/** Status da planilha que indicam projeto encerrado — não aparecem no
 *  autocomplete. A planilha exportada hoje só traz ATIVO e STAND BY, mas a
 *  lista é mantida à mão e nada impede que um CANCELADO apareça amanhã. */
const STATUS_ENCERRADOS = ["CANCELADO", "FINALIZADO", "ENCERRADO"];

/**
 * Lista para o seletor de projeto, ordenada por cliente.
 *
 * São ~60 projetos, então a lista inteira vai de uma vez para a tela e a
 * busca acontece no navegador — sem ida e volta ao servidor a cada tecla.
 * Se um dia passar de alguns milhares, aí sim vale paginar no servidor.
 *
 * Nunca lança: se a consulta falhar, devolve `[]`, o campo vira texto livre e
 * a solicitação continua podendo ser aberta. Uma lista de apoio indisponível
 * não pode impedir alguém de pedir uma peça.
 */
export async function listarProjetos(): Promise<ProjetoOpcao[]> {
  try {
    const projetos = await prisma.projeto.findMany({
      select: { codigo: true, cliente: true, projeto: true, status: true },
      orderBy: [{ cliente: "asc" }, { codigo: "asc" }],
    });
    return projetos
      .filter((p) => !STATUS_ENCERRADOS.includes((p.status ?? "").trim().toUpperCase()))
      .map(({ codigo, cliente, projeto }) => ({ codigo, cliente, projeto }));
  } catch (erro) {
    console.error("[projetos] não foi possível carregar a lista:", erro);
    return [];
  }
}
