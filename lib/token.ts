// Assinatura e verificação do cookie de sessão via JWT (HS256).
//
// Usa `jose`, e não `jsonwebtoken`, porque este módulo é importado pelo
// middleware.ts, que roda em Edge Runtime — jsonwebtoken e bcryptjs dependem
// de APIs do Node (crypto nativo) que o Edge não tem.
import { SignJWT, jwtVerify } from "jose";
import { Papel } from "@prisma/client";

// Sem fallback e sem valor padrão: se JWT_SECRET não estiver definida, é
// melhor quebrar o boot de forma explícita do que assinar tokens com uma
// chave vazia ou embutida no código — qualquer um que lesse o repositório
// forjaria um token de admin.
const JWT_SECRET_ENV = process.env.JWT_SECRET;
if (!JWT_SECRET_ENV) {
  throw new Error(
    "JWT_SECRET não está definida. Configure a variável de ambiente JWT_SECRET " +
      "(veja .env.example) antes de iniciar a aplicação — sem ela não é seguro assinar sessões."
  );
}
const SECRET = new TextEncoder().encode(JWT_SECRET_ENV);

export interface SessionTokenPayload {
  id: string;
  email: string;
  papel: Papel;
  nome: string;
  /** Permissão à parte do papel — ver Usuario.gerenciaAcessos no schema.
   *  Vai no token só para o middleware (que não lê o banco) poder barrar
   *  /usuarios; o valor autoritativo é sempre relido em getUsuarioSessao. */
  gerenciaAcessos: boolean;
}

export const SESSION_COOKIE = "sga_session";

/** 12 horas — a mesma validade que a sessão de gestor tinha na versão
 *  anterior do SGA. Cobre um dia de trabalho sem pedir login de novo, e
 *  expira antes do dia seguinte. */
export const SESSION_MAX_AGE_SEGUNDOS = 60 * 60 * 12;

export async function assinarToken(payload: SessionTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(SECRET);
}

export async function verificarToken(token: string): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionTokenPayload;
  } catch {
    // Assinatura inválida, token expirado ou corrompido caem todos aqui. Quem
    // chama trata "null" como "não autenticado" — não há o que distinguir.
    return null;
  }
}
