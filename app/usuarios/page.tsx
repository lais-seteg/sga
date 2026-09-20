import { prisma } from "@/lib/prisma";
import { requireGestaoDeAcessos } from "@/lib/session";
import UsuariosClient, { UsuarioLinha } from "./UsuariosClient";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  // Não basta ser admin: gerir contas é permissão própria (ver
  // Usuario.gerenciaAcessos). Hoje só a Eveline tem.
  const sessao = await requireGestaoDeAcessos();

  // `select` explícito, nunca findMany solto: sem ele o `senhaHash` viria
  // junto e atravessaria a fronteira servidor→cliente dentro do payload da
  // página, legível por qualquer um que abrisse o inspetor. O hash não é a
  // senha, mas também não tem por que sair do servidor.
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      ativo: true,
      setor: true,
      gerenciaAcessos: true,
      ultimoAcessoEm: true,
      _count: { select: { solicitacoes: true } },
    },
    orderBy: { nome: "asc" },
  });

  const linhas: UsuarioLinha[] = usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    ativo: u.ativo,
    setor: u.setor,
    gerenciaAcessos: u.gerenciaAcessos,
    ultimoAcessoEm: u.ultimoAcessoEm ? u.ultimoAcessoEm.toISOString() : null,
    solicitacoes: u._count.solicitacoes,
  }));

  return <UsuariosClient usuarios={linhas} usuarioAtualId={sessao.id} />;
}
