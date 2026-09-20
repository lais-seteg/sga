import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { calcularIndicadores, medirSolicitacao } from "@/lib/indicadores";
import DashboardClient, { LinhaSetor } from "./DashboardClient";

export const dynamic = "force-dynamic";

/** Janelas de tempo oferecidas no filtro, em dias. `null` = desde o começo. */
const PERIODOS: Record<string, number | null> = {
  "30": 30,
  "90": 90,
  "365": 365,
  tudo: null,
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { periodo?: string };
}) {
  // Indicadores de produtividade da equipe de produção — perfil Admin.
  // Diferente de /usuarios, que exige a permissão separada de gerir contas.
  await requireRole([Papel.admin]);

  const chavePeriodo = searchParams.periodo && searchParams.periodo in PERIODOS
    ? searchParams.periodo
    : "365";
  const janelaEmDias = PERIODOS[chavePeriodo];
  const desde = janelaEmDias
    ? new Date(Date.now() - janelaEmDias * 24 * 60 * 60 * 1000)
    : undefined;

  const solicitacoes = await prisma.solicitacao.findMany({
    where: desde ? { criadoEm: { gte: desde } } : {},
    select: {
      id: true,
      protocolo: true,
      solicitanteSetor: true,
      status: true,
      criadoEm: true,
      prazoIdeal: true,
      prazoLimite: true,
      eventos: {
        select: { statusNovo: true, criadoEm: true, inferido: true },
        orderBy: { criadoEm: "asc" },
      },
    },
  });

  const medidas = solicitacoes.map((s) => medirSolicitacao(s));
  const indicadores = calcularIndicadores(medidas);

  // Recorte por setor: mostra de onde vem a demanda e onde o prazo aperta.
  // Só setores com pedido no período — linha zerada não informa nada.
  const porSetor = new Map<string, LinhaSetor>();
  for (const m of medidas) {
    const linha = porSetor.get(m.setor) ?? {
      setor: m.setor,
      total: 0,
      finalizadas: 0,
      noPrazo: 0,
      avaliadas: 0,
      retrabalhos: 0,
      prazoTotalSoma: 0,
    };
    linha.total += 1;
    if (m.prazoTotal !== null) {
      linha.finalizadas += 1;
      linha.prazoTotalSoma += m.prazoTotal;
    }
    if (m.dentroDoPrazoLimite !== null) {
      linha.avaliadas += 1;
      if (m.dentroDoPrazoLimite) linha.noPrazo += 1;
    }
    linha.retrabalhos += m.retrabalhos;
    porSetor.set(m.setor, linha);
  }

  // `Array.from` em vez de espalhar o iterador: o tsconfig herdado do
  // ClockRView não liga `downlevelIteration`, e espalhar um MapIterator não
  // compila ali.
  const setores = Array.from(porSetor.values()).sort((a, b) => b.total - a.total);

  return (
    <DashboardClient
      indicadores={indicadores}
      setores={setores}
      periodo={chavePeriodo}
    />
  );
}
