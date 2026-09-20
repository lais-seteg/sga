// Importa a planilha CLIENTES_ATIVOS para a tabela `projetos`, que alimenta o
// autocomplete de "Código do Projeto | Cliente" no formulário de solicitação.
//
// Por que importar em vez de ler o arquivo direto: a planilha vive no
// computador de quem a mantém, e em produção (Vercel) esse arquivo não
// existe. O banco é o que os dois ambientes enxergam.
//
// Uso:
//   npm run importar:projetos -- "C:\\caminho\\CLIENTES_ATIVOS.csv"
//   npm run importar:projetos                 (usa o caminho padrão abaixo)
//   npm run importar:projetos -- --simular    (mostra o que faria, sem gravar)
//
// Exporte a planilha do Excel como "CSV (separado por vírgulas)" — que no
// Windows em português gera um arquivo separado por PONTO E VÍRGULA e
// codificado em Windows-1252. O script lida com os dois detalhes.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const CAMINHO_PADRAO = path.join(
  os.homedir(),
  "Downloads",
  "CLIENTES_ATIVOS(CLIENTES_ATIVOS).csv"
);

// Colunas que o script espera na primeira linha. A planilha é mantida à mão,
// então a validação existe: renomear uma coluna sem avisar quebraria a
// importação silenciosamente, deixando o campo vazio para todo mundo.
const COLUNAS = {
  cliente: "CLIENTE",
  segmento: "SEGMENTO DO CLIENTE",
  lider: "LIDER",
  vendedor: "VENDEDOR",
  codigo: "CÓDIGO DO PROJETO",
  acesso: "ACESSO",
  projeto: "PROJETO",
  escopo: "ESCOPO GERAL",
  status: "STATUS",
};

/** Abaixo disto, a importação para em vez de apagar a lista. Um CSV truncado
 *  ou exportado da aba errada não pode esvaziar o autocomplete de todo mundo. */
const MINIMO_ESPERADO = 5;

function lerCsv(caminho) {
  if (!fs.existsSync(caminho)) {
    throw new Error(
      `planilha não encontrada em:\n  ${caminho}\n` +
        `Passe o caminho: npm run importar:projetos -- "C:\\caminho\\arquivo.csv"`
    );
  }
  // Windows-1252, não UTF-8: é o que o Excel em português gera. Lido como
  // UTF-8, "IMPLANTAÇÃO" chega como "IMPLANTA��O".
  const texto = new TextDecoder("windows-1252").decode(fs.readFileSync(caminho));
  const linhas = texto.split(/\r?\n/);

  const cabecalho = linhas[0].split(";").map((c) => c.trim());
  const faltando = Object.values(COLUNAS).filter((c) => !cabecalho.includes(c));
  if (faltando.length) {
    throw new Error(
      `a planilha não tem a(s) coluna(s): ${faltando.join(", ")}.\n` +
        `Colunas encontradas: ${cabecalho.filter(Boolean).join(", ")}`
    );
  }

  const indice = {};
  for (const [campo, titulo] of Object.entries(COLUNAS)) {
    indice[campo] = cabecalho.indexOf(titulo);
  }

  const registros = [];
  for (const linha of linhas.slice(1)) {
    const celulas = linha.split(";");
    const valor = (campo) => (celulas[indice[campo]] ?? "").trim();

    // O Excel exporta ~1 milhão de linhas vazias depois dos dados. O código do
    // projeto é o sinal confiável de "esta linha é um registro de verdade".
    const codigoBruto = valor("codigo");
    if (!codigoBruto) continue;

    // O "#" é enfeite da planilha. Some aqui para o código gravado na
    // solicitação bater com o que a pessoa lê e digita.
    const codigo = codigoBruto.replace(/^#/, "").trim();
    if (!codigo) continue;

    const cliente = valor("cliente");
    if (!cliente) {
      console.warn(`[importar] projeto ${codigo} sem CLIENTE preenchido — ignorado.`);
      continue;
    }

    registros.push({
      codigo,
      cliente,
      segmento: valor("segmento") || null,
      projeto: valor("projeto") || null,
      escopo: valor("escopo") || null,
      lider: valor("lider") || null,
      vendedor: valor("vendedor") || null,
      acesso: valor("acesso") || null,
      status: valor("status") || null,
    });
  }

  // Código repetido na planilha: fica o último, porque é o mais abaixo e
  // costuma ser a correção de uma linha anterior.
  const porCodigo = new Map();
  for (const r of registros) {
    if (porCodigo.has(r.codigo)) {
      console.warn(`[importar] código repetido na planilha: ${r.codigo} — fica a última ocorrência.`);
    }
    porCodigo.set(r.codigo, r);
  }

  return [...porCodigo.values()];
}

async function main() {
  const args = process.argv.slice(2);
  const simular = args.includes("--simular");
  const caminho = args.find((a) => !a.startsWith("--")) ?? CAMINHO_PADRAO;

  console.log(`[importar] lendo: ${caminho}`);
  const registros = lerCsv(caminho);
  console.log(`[importar] ${registros.length} projeto(s) na planilha.`);

  if (registros.length < MINIMO_ESPERADO) {
    throw new Error(
      `só ${registros.length} projeto(s) encontrado(s), abaixo do mínimo de ${MINIMO_ESPERADO}. ` +
        `Isso costuma indicar CSV truncado, aba errada ou separador diferente. ` +
        `Nada foi alterado — confira o arquivo.`
    );
  }

  const existentes = await prisma.projeto.findMany({ select: { codigo: true } });
  const codigosPlanilha = new Set(registros.map((r) => r.codigo));
  const aRemover = existentes.filter((p) => !codigosPlanilha.has(p.codigo)).map((p) => p.codigo);
  const novos = registros.filter((r) => !existentes.some((e) => e.codigo === r.codigo)).length;

  console.log(
    `[importar] ${novos} novo(s), ${registros.length - novos} atualizado(s), ${aRemover.length} a remover.`
  );

  if (simular) {
    console.log("[importar] --simular: nada foi gravado.");
    if (aRemover.length) console.log(`[importar] sairiam: ${aRemover.join(", ")}`);
    return;
  }

  // Tudo numa transação: a planilha é a fonte de verdade, então ou o banco
  // fica idêntico a ela, ou fica como estava. Um erro no meio não pode deixar
  // metade dos projetos novos e metade dos velhos.
  await prisma.$transaction([
    ...registros.map((r) =>
      prisma.projeto.upsert({
        where: { codigo: r.codigo },
        create: r,
        update: { ...r, atualizadoEm: new Date() },
      })
    ),
    // Projeto que saiu da planilha sai do autocomplete. As solicitações que já
    // apontam para ele não são afetadas: `solicitacoes.solicitante_cliente`
    // guarda o código como texto, sem chave estrangeira, justamente para o
    // histórico não depender de uma lista que muda.
    prisma.projeto.deleteMany({ where: { codigo: { in: aRemover } } }),
  ]);

  const total = await prisma.projeto.count();
  console.log(`[importar] pronto. ${total} projeto(s) no banco.`);
}

main()
  .catch((erro) => {
    console.error("[importar]", erro.message ?? erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
