import { PrismaClient } from "@prisma/client";

// Instância única reaproveitada entre os hot-reloads do desenvolvimento. Sem
// isto, cada recompilação abriria um pool novo e o Postgres do Supabase
// passaria a recusar conexão depois de algumas edições.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
