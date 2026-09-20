import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Atributos idênticos aos do `set` em /api/auth/login: um cookie de limpeza
  // com atributos diferentes (sem sameSite/secure, por exemplo) pode não
  // sobrescrever o original em alguns navegadores — e a sessão continuaria
  // valendo depois de clicar em "Sair".
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
