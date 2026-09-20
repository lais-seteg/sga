import type { Metadata } from "next";
import "./globals.css";
import PageLayout from "@/app/components/PageLayout";
import { getUsuarioSessao } from "@/lib/session";

export const metadata: Metadata = {
  title: "SGA Seteg",
  description: "Sistema de Solicitação de Peças Gráficas — SETEG",
  icons: { icon: "/favicon.png" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioSessao();

  return (
    <html lang="pt-BR">
      <head>
        {/* A Satoshi é servida pelo próprio site (@font-face em globals.css),
            então só os ícones vêm de fora. `media="print"` + troca por script
            puro (sem onLoad do React — isto é um Server Component e não pode
            ter handler de evento) é o truque padrão para CSS externo não
            crítico não travar o evento `load` da página: se o CDN estiver
            lento ou bloqueado, a página carrega normalmente e os ícones
            aparecem assim que (e se) a folha chegar. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
          media="print"
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('load',function(){" +
              "document.querySelectorAll('link[media=\"print\"]').forEach(function(l){l.media='all';});" +
              "});",
          }}
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
          />
        </noscript>
      </head>
      <body>
        {/* Sem sessão, o conteúdo é a própria tela de login — que não leva
            barra lateral nem nome de usuário no rodapé dela. */}
        {usuario ? <PageLayout usuario={usuario}>{children}</PageLayout> : <main>{children}</main>}
      </body>
    </html>
  );
}
