import bcrypt from "bcryptjs";

// Hash e comparação de senha (bcrypt). Só é importado por route handlers e
// pelo seed, que rodam em runtime Node.js.
//
// NUNCA importe este arquivo a partir do middleware.ts, nem de código que ele
// carregue: o Edge Runtime não tem o `crypto` nativo de que o bcryptjs
// depende, e o build quebra. Para o JWT de sessão, que precisa funcionar em
// Edge, use lib/token.ts.

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export async function compararSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export {
  assinarToken,
  verificarToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEGUNDOS,
  type SessionTokenPayload,
} from "@/lib/token";
