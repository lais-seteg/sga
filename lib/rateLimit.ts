// Freio de tentativas de login, contado no BANCO.
//
// ── Por que saiu da memória do processo ──────────────────────────────────
//
// A versão anterior guardava o contador num `Map` do processo. Isso fazia
// sentido quando o plano era um servidor Node único, mas o SGA roda na Vercel:
// cada invocação pode cair numa instância nova, e o contador zerava a cada
// cold start. Bastava espaçar as tentativas para nunca bater no limite — ou
// seja, na prática o freio quase não existia, justamente no ambiente em que
// mais importava. No banco o contador é um só para todas as instâncias.
//
// ── O custo ──────────────────────────────────────────────────────────────
//
// Duas consultas a mais no caminho do login (uma leitura antes, uma escrita
// depois) e nenhuma em qualquer outra tela. Login é operação rara — ninguém
// entra no sistema dez vezes por minuto —, então isso não aparece no uso do
// dia a dia.
//
// ── Por que falha ABERTO ─────────────────────────────────────────────────
//
// Se a consulta do freio quebrar, a tentativa é permitida em vez de negada.
// Um limitador que derruba o login inteiro quando o banco soluça é pior do
// que limitador nenhum — e não abre brecha real: sem banco, o login também
// não consegue conferir a senha, então não há o que forçar.

import { prisma } from "@/lib/prisma";

/** Janela para acumular falhas antes de bloquear. */
const JANELA_MS = 5 * 60 * 1000;
/** Falhas seguidas até o bloqueio. */
const MAX_TENTATIVAS = 5;
/** Duração do bloqueio. */
const BLOQUEIO_MS = 15 * 60 * 1000;
/** Registros mais velhos que isto não servem para nada e são varridos. */
const VALIDADE_REGISTRO_MS = 24 * 60 * 60 * 1000;

/**
 * Extrai o IP do cliente. Na Vercel, `x-forwarded-for` é preenchido pela
 * borda e o primeiro item é o IP real de quem chamou — diferente de um
 * servidor exposto direto, onde o cliente poderia forjar o cabeçalho.
 */
export function obterIpCliente(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff && xff.trim()) return xff.split(",")[0].trim();
  return "desconhecido";
}

function chaveDe(ip: string, email: string): string {
  return `${ip}::${email.trim().toLowerCase()}`;
}

export interface ResultadoLimite {
  bloqueado: boolean;
  /** Segundos restantes do bloqueio, presente apenas se bloqueado. */
  segundosRestantes?: number;
}

/** Confere se a combinação IP+e-mail está bloqueada agora. Não registra nada. */
export async function verificarLimite(ip: string, email: string): Promise<ResultadoLimite> {
  try {
    const registro = await prisma.tentativaLogin.findUnique({
      where: { chave: chaveDe(ip, email) },
      select: { bloqueadoAte: true },
    });
    if (!registro?.bloqueadoAte) return { bloqueado: false };

    const restanteMs = registro.bloqueadoAte.getTime() - Date.now();
    if (restanteMs <= 0) return { bloqueado: false };

    return { bloqueado: true, segundosRestantes: Math.ceil(restanteMs / 1000) };
  } catch (erro) {
    console.error("[rateLimit] falha ao consultar o freio — liberando a tentativa:", erro);
    return { bloqueado: false };
  }
}

/** Registra uma tentativa que falhou (e-mail inexistente, conta inativa, senha errada). */
export async function registrarFalha(ip: string, email: string): Promise<void> {
  const chave = chaveDe(ip, email);
  const agora = new Date();

  try {
    const atual = await prisma.tentativaLogin.findUnique({
      where: { chave },
      select: { falhas: true, primeiraFalhaEm: true },
    });

    // Fora da janela, a contagem recomeça: cinco erros espalhados por um mês
    // são esquecimento, não ataque.
    const dentroDaJanela =
      atual !== null && agora.getTime() - atual.primeiraFalhaEm.getTime() <= JANELA_MS;
    const falhas = dentroDaJanela ? atual.falhas + 1 : 1;
    const bloqueadoAte =
      falhas >= MAX_TENTATIVAS ? new Date(agora.getTime() + BLOQUEIO_MS) : null;

    await prisma.tentativaLogin.upsert({
      where: { chave },
      create: { chave, falhas, primeiraFalhaEm: agora, bloqueadoAte },
      update: {
        falhas,
        bloqueadoAte,
        ...(dentroDaJanela ? {} : { primeiraFalhaEm: agora }),
      },
    });

    // Limpeza oportunista, só quando já se está escrevendo: sem isto a tabela
    // cresceria para sempre com registros que não valem mais nada.
    await prisma.tentativaLogin.deleteMany({
      where: { atualizadoEm: { lt: new Date(agora.getTime() - VALIDADE_REGISTRO_MS) } },
    });
  } catch (erro) {
    console.error("[rateLimit] falha ao registrar tentativa:", erro);
  }
}

/**
 * Login certo: zera o histórico daquela combinação IP+e-mail.
 *
 * Um acerto apaga a dívida de erros anteriores — não faz sentido penalizar
 * quem digitou errado duas vezes e acertou na terceira.
 */
export async function registrarSucesso(ip: string, email: string): Promise<void> {
  try {
    await prisma.tentativaLogin.deleteMany({ where: { chave: chaveDe(ip, email) } });
  } catch (erro) {
    console.error("[rateLimit] falha ao limpar tentativas:", erro);
  }
}
