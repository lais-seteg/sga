// Regras de conta compartilhadas entre POST /api/usuarios (criar) e
// PATCH /api/usuarios/[id] (editar). Vivem aqui, e não dentro de uma das
// rotas, para que nenhuma das duas importe a outra: um route handler
// importando outro route handler faz o Next.js carregar o módulo inteiro —
// incluindo o próprio `POST` — só para pegar uma constante.

/**
 * Política mínima de senha: comprimento, e só.
 *
 * Exigir composição (maiúscula, dígito, símbolo) empurra quem administra a
 * inventar senhas previsíveis — "Seteg@2026" satisfaz qualquer regra de
 * composição e é péssima. Comprimento é o que de fato encarece um ataque, e
 * 12 caracteres já saem da faixa de força bruta viável.
 *
 * O piso começou em 6 para acomodar a carga inicial de contas, que inclui uma
 * senha de 7 caracteres. Subiu para 12 depois que o sistema entrou em uso.
 *
 * Isso NÃO invalida nenhuma senha existente: a regra só é aplicada quando uma
 * senha é DEFINIDA (criação de conta ou redefinição). Quem já tem uma senha
 * curta continua entrando normalmente — o ganho aparece a partir da próxima
 * troca. Para que ele valha para todo mundo de imediato, seria preciso forçar
 * a troca no primeiro acesso, que é uma decisão de operação, não de código.
 */
export const SENHA_MIN = 12;
export const SENHA_MSG = `A senha deve ter no mínimo ${SENHA_MIN} caracteres. Comprimento protege mais que símbolos: uma frase como "banner azul da seteg" é forte e fácil de lembrar.`;
export const SENHA_MAX = 200;

export const NOME_MAX = 200;

/** Formato básico (tem "@" e um domínio com ponto). Não valida
 *  entregabilidade — só evita cadastrar algo como "abc", que quebraria o
 *  login logo depois. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
