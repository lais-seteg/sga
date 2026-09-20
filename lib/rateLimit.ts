// Limitador de tentativas de login em memória do processo — sem Redis, sem
// dependência nova, pensado para o estágio atual do produto (um único
// processo Next.js rodando local ou atrás de um túnel).
//
// Estratégia: bloqueia por combinação IP + email após N falhas consecutivas
// em uma janela curta. Chave composta (não só IP, não só email) para que:
// - um atacante testando muitos emails do mesmo IP seja freado por email
//   (evita username enumeration em massa), e
// - tentativas de terceiros contra o email de um usuário legítimo, vindas de
//   outro IP, não bloqueiem o dono real da conta.
//
// Limitações conhecidas e aceitas para este estágio do produto:
// 1. Reiniciar o processo (deploy, crash, restart) zera todos os contadores.
// 2. Não funciona corretamente com múltiplas instâncias/processos (cluster,
//    PM2 em modo cluster, várias réplicas) — cada uma teria seu próprio
//    estado. Hoje o app roda em processo único, então é aceitável.
// 3. `x-forwarded-for` pode ser falsificado por um cliente se não houver um
//    proxy reverso confiável na frente sobrescrevendo esse header antes de
//    chegar à aplicação. No cenário atual (acesso local/túnel, sem proxy
//    corporativo dedicado) isso é uma limitação aceita — o objetivo aqui é
//    frear força bruta trivial, não blindar contra um atacante sofisticado
//    que controla sua própria origem de rede.

const JANELA_MS = 5 * 60 * 1000; // 5 minutos para acumular tentativas
const MAX_TENTATIVAS = 5; // tentativas falhas seguidas antes de bloquear
const BLOQUEIO_MS = 5 * 60 * 1000; // duração do bloqueio

interface Registro {
  falhas: number;
  primeiraFalhaEm: number;
  bloqueadoAte: number | null;
}

const registros = new Map<string, Registro>();

/** Limpeza oportunista de entradas expiradas, para não crescer sem limite. */
function limparExpirados(agora: number): void {
  for (const [chave, r] of Array.from(registros)) {
    const bloqueioExpirado = !r.bloqueadoAte || r.bloqueadoAte < agora;
    const janelaExpirada = agora - r.primeiraFalhaEm > JANELA_MS;
    if (bloqueioExpirado && janelaExpirada) {
      registros.delete(chave);
    }
  }
}

/**
 * Extrai um identificador de IP do cliente a partir do header
 * `x-forwarded-for`. Ver limitação (3) no cabeçalho deste arquivo: sem um
 * proxy confiável na frente, este valor pode ser falsificado pelo próprio
 * cliente. Aceitável para o estágio atual.
 */
export function obterIpCliente(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  return "desconhecido";
}

function chaveDe(ip: string, email: string): string {
  return `${ip}::${email.trim().toLowerCase()}`;
}

export interface ResultadoLimite {
  bloqueado: boolean;
  /** Segundos restantes até o bloqueio acabar, presente apenas se bloqueado. */
  segundosRestantes?: number;
}

/** Verifica se a combinação IP+email está atualmente bloqueada. Não registra nada. */
export function verificarLimite(ip: string, email: string): ResultadoLimite {
  const agora = Date.now();
  limparExpirados(agora);

  const registro = registros.get(chaveDe(ip, email));
  if (!registro || !registro.bloqueadoAte) {
    return { bloqueado: false };
  }
  if (registro.bloqueadoAte > agora) {
    return { bloqueado: true, segundosRestantes: Math.ceil((registro.bloqueadoAte - agora) / 1000) };
  }
  return { bloqueado: false };
}

/** Registra uma tentativa de login que falhou (email/senha inválidos, usuário inativo, etc.). */
export function registrarFalha(ip: string, email: string): void {
  const agora = Date.now();
  const chave = chaveDe(ip, email);
  let registro = registros.get(chave);

  if (!registro || agora - registro.primeiraFalhaEm > JANELA_MS) {
    registro = { falhas: 0, primeiraFalhaEm: agora, bloqueadoAte: null };
  }

  registro.falhas += 1;
  if (registro.falhas >= MAX_TENTATIVAS) {
    registro.bloqueadoAte = agora + BLOQUEIO_MS;
  }
  registros.set(chave, registro);
}

/**
 * Login bem-sucedido: limpa o contador dessa combinação IP+email.
 * Escolha de design: um acerto reseta o histórico de falhas — não deixamos
 * "dívida" de tentativas erradas anteriores penalizando logins futuros
 * legítimos. O bloqueio em andamento (se já disparado) permanece valendo
 * até expirar, mas esse branch só é alcançado quando não há bloqueio ativo.
 */
export function registrarSucesso(ip: string, email: string): void {
  registros.delete(chaveDe(ip, email));
}
