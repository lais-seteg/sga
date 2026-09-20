import Sidebar from "./Sidebar";
import { SessionTokenPayload } from "@/lib/token";

export default function PageLayout({
  usuario,
  children,
}: {
  usuario: SessionTokenPayload;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar
        papel={usuario.papel}
        nome={usuario.nome}
        email={usuario.email}
        gerenciaAcessos={usuario.gerenciaAcessos}
      />
      <main style={{ marginLeft: 224, flex: 1, padding: "28px 32px", minWidth: 0 }}>{children}</main>
    </div>
  );
}
