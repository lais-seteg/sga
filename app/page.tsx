import { redirect } from "next/navigation";

// A raiz não tem tela própria: quem chega logado vai para a fila de
// solicitações, quem chega deslogado é desviado para /login pelo middleware.
export default function RootPage() {
  redirect("/solicitacoes");
}
