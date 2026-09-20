// Cadastra as contas de acesso do SGA a partir de secrets/usuarios-iniciais.json.
//
// A lista de nomes, e-mails e senhas NÃO vive no código: vive em
// `secrets/`, que está no .gitignore (ver secrets/README.md). Assim o
// repositório pode ser público, clonado ou espelhado sem carregar credencial
// nenhuma — o que o git guarda é o procedimento, não o segredo.
//
// Idempotente por e-mail: quem já existe é PULADO por inteiro — nome, papel e
// senha ficam como estão. Isso é deliberado. Se o script sobrescrevesse, um
// `npm run seed:usuarios` rodado por engano meses depois desfaria em silêncio
// toda troca de senha feita pela tela /usuarios e devolveria as senhas
// iniciais a todo mundo.
//
// Uso:
//   npm run seed:usuarios

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const ARQUIVO = path.join(__dirname, "..", "secrets", "usuarios-iniciais.json");

const PAPEIS = ["admin", "colaborador"];
const SENHA_MIN = 6;

function carregarLista() {
  if (!fs.existsSync(ARQUIVO)) {
    throw new Error(
      `arquivo não encontrado: ${ARQUIVO}\n` +
        "Crie-o com a lista de contas (o formato está em secrets/README.md)."
    );
  }
  const lista = JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
  if (!Array.isArray(lista) || lista.length === 0) {
    throw new Error("secrets/usuarios-iniciais.json precisa ser um array não vazio.");
  }
  return lista;
}

/** Valida a lista INTEIRA antes de gravar qualquer linha: melhor recusar tudo
 *  do que cadastrar as 20 primeiras contas e parar na 21 com o banco pela
 *  metade. */
function validar(lista) {
  const problemas = [];
  const vistos = new Set();

  lista.forEach((item, i) => {
    const onde = `item ${i + 1}`;
    if (!item || typeof item !== "object") {
      problemas.push(`${onde}: não é um objeto`);
      return;
    }
    if (!item.nome || typeof item.nome !== "string") problemas.push(`${onde}: nome ausente`);
    if (!item.email || typeof item.email !== "string") {
      problemas.push(`${onde}: e-mail ausente`);
    } else {
      const email = item.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problemas.push(`${onde}: e-mail inválido (${email})`);
      if (vistos.has(email)) problemas.push(`${onde}: e-mail repetido na lista (${email})`);
      vistos.add(email);
    }
    if (!PAPEIS.includes(item.papel)) {
      problemas.push(`${onde}: papel deve ser ${PAPEIS.join(" ou ")} (veio "${item.papel}")`);
    }
    if (typeof item.senha !== "string" || item.senha.length < SENHA_MIN) {
      problemas.push(`${onde}: senha precisa ter ao menos ${SENHA_MIN} caracteres`);
    }
  });

  if (problemas.length) {
    throw new Error(`lista inválida:\n  - ${problemas.join("\n  - ")}`);
  }
}

async function main() {
  const lista = carregarLista();
  validar(lista);

  let criados = 0;
  let pulados = 0;

  for (const item of lista) {
    const email = item.email.trim().toLowerCase();
    const existente = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
    if (existente) {
      pulados += 1;
      continue;
    }
    await prisma.usuario.create({
      data: {
        nome: item.nome.trim(),
        email,
        senhaHash: await bcrypt.hash(item.senha, 10),
        papel: item.papel,
        setor: item.setor ? String(item.setor).trim() : null,
      },
    });
    criados += 1;
    console.log(`[seed] criada: ${email} (${item.papel})`);
  }

  const admins = await prisma.usuario.count({ where: { papel: "admin", ativo: true } });
  console.log(`\n[seed] ${criados} conta(s) criada(s), ${pulados} já existia(m).`);
  console.log(`[seed] ${admins} administrador(es) ativo(s).`);

  // Um sistema sem admin ativo não tem como gerenciar contas nem mover a fila
  // — só um acesso direto ao banco resolveria. Avisa alto.
  if (admins === 0) {
    console.warn("[seed] ATENÇÃO: nenhum administrador ativo. Ninguém consegue gerenciar acessos.");
  }
}

main()
  .catch((erro) => {
    console.error("[seed]", erro.message ?? erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
