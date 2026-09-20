// Regras de conta compartilhadas entre POST /api/usuarios (criar) e
// PATCH /api/usuarios/[id] (editar). Vivem aqui, e não dentro de uma das
// rotas, para que nenhuma das duas importe a outra: um route handler
// importando outro route handler faz o Next.js carregar o módulo inteiro —
// incluindo o próprio `POST` — só para pegar uma constante.

/**
 * Política mínima de senha. Só comprimento: exigir composição (maiúscula,
 * dígito, símbolo) empurra quem administra a inventar senhas previsíveis, e
 * aqui a senha é definida por um admin e entregue à pessoa fora do sistema.
 *
 * O piso é 6 (e não 8) por um motivo concreto: a carga inicial de contas
 * definida pela Seteg inclui uma senha de 7 caracteres. Com o mínimo em 8,
 * essa conta existiria no banco mas não poderia ser reeditada pela própria
 * tela — a validação recusaria a senha que ela já usa.
 */
export const SENHA_MIN = 6;
export const SENHA_MSG = `A senha deve ter no mínimo ${SENHA_MIN} caracteres.`;
export const SENHA_MAX = 200;

export const NOME_MAX = 200;

/** Formato básico (tem "@" e um domínio com ponto). Não valida
 *  entregabilidade — só evita cadastrar algo como "abc", que quebraria o
 *  login logo depois. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
