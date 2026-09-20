"use client";

// Barra lateral (ícone + texto), mesmo padrão visual do ClockRView e do Bem
// Te Vi. Substitui o cabeçalho horizontal com botão "Gestor" da versão
// anterior: agora o sistema é fechado, então há sempre alguém logado e a
// navegação pode assumir o lugar fixo da esquerda.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Papel } from "@prisma/client";
import { initialsFromName } from "./ui-helpers";

interface ItemNav {
  href: string;
  label: string;
  icon: string;
  /** Omitido = visível para qualquer pessoa autenticada. */
  papeis?: Papel[];
  /** Quando true, o item só aparece para quem tem a permissão de mexer em
   *  contas — que é separada do papel (ver Usuario.gerenciaAcessos). */
  exigeGestaoDeAcessos?: boolean;
}

const ITENS: ItemNav[] = [
  { href: "/solicitacoes", label: "Solicitações", icon: "bi-folder2-open" },
  { href: "/dashboard", label: "Indicadores", icon: "bi-graph-up", papeis: [Papel.admin] },
  {
    href: "/usuarios",
    label: "Gestão de Acessos",
    icon: "bi-person-gear",
    exigeGestaoDeAcessos: true,
  },
];

const PAPEL_LABEL: Record<Papel, string> = {
  [Papel.admin]: "Admin",
  [Papel.colaborador]: "Colaborador",
};

export default function Sidebar({
  papel,
  nome,
  email,
  gerenciaAcessos,
}: {
  papel: Papel;
  nome: string;
  email: string;
  gerenciaAcessos: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Esconder o item é conveniência, não segurança: quem digitar /usuarios na
  // barra de endereço é barrado pelo middleware e de novo pela própria página
  // (requireGestaoDeAcessos).
  const itensVisiveis = ITENS.filter((item) => {
    if (item.papeis && !item.papeis.includes(papel)) return false;
    if (item.exigeGestaoDeAcessos && !gerenciaAcessos) return false;
    return true;
  });

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    // `refresh` força o layout (Server Component) a recarregar sem o usuário;
    // sem ele a barra lateral continuaria montada por um instante.
    router.refresh();
  }

  return (
    <aside
      style={{
        width: 224,
        flexShrink: 0,
        background: "var(--navy)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        zIndex: 100,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 20px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <img src="/seteg-negativo.png" alt="Seteg" style={{ height: 46, width: "auto" }} />
      </div>

      <nav
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "14px 12px",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.35)",
            padding: "4px 14px 8px",
          }}
        >
          Peças Gráficas
        </div>

        {itensVisiveis.map((item) => {
          const ativo = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: "var(--r-md)",
                fontSize: 13.5,
                fontWeight: 600,
                color: ativo ? "var(--orange)" : "rgba(255,255,255,0.75)",
                background: ativo ? "rgba(255,130,0,0.14)" : "transparent",
                textDecoration: "none",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <i
                className={`bi ${item.icon}`}
                style={{ fontSize: 16, width: 18, textAlign: "center", flexShrink: 0 }}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            marginBottom: 4,
            borderRadius: "var(--r-md)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--orange), rgba(255,130,0,0.75))",
              color: "#fff",
              fontWeight: 700,
              fontSize: 12.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {initialsFromName(nome)}
          </div>
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={email}
            >
              {nome}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#ffb066" }}>{PAPEL_LABEL[papel]}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            padding: "10px 14px",
            borderRadius: "var(--r-md)",
            fontSize: 13.5,
            fontWeight: 600,
            color: "#f87171",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
          }}
        >
          <img src="/icon-logout.svg" alt="" style={{ width: 16, height: 16, flexShrink: 0 }} />
          Sair
        </button>
      </div>
    </aside>
  );
}
