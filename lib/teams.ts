// Notificação no Teams via Power Automate.
//
// Mudança em relação à versão anterior: o webhook é chamado pelo SERVIDOR,
// nunca pelo navegador. Antes a URL ia embutida no bundle (`VITE_*`) e
// qualquer visitante conseguia lê-la no código-fonte da página e disparar
// cards falsos em nome do sistema. Agora TEAMS_WEBHOOK_URL nunca sai do
// servidor.
//
// A chamada acontece DEPOIS que a solicitação já está gravada: se o webhook
// falhar, o pedido continua salvo. Nada aqui propaga erro.

export interface FatoTeams {
  title: string;
  value: string;
}

function urlDoApp(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  // Atalho para os deploys de preview da Vercel — sem ele seria preciso
  // cadastrar APP_URL em cada um só para o botão do card apontar para algum
  // lugar.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function notificarTeams(
  titulo: string,
  fatos: FatoTeams[],
  descricao?: string | null
): Promise<void> {
  const webhook = process.env.TEAMS_WEBHOOK_URL;
  if (!webhook) {
    console.warn("[teams] TEAMS_WEBHOOK_URL não configurada — notificação não enviada.");
    return;
  }

  try {
    const resposta = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              type: "AdaptiveCard",
              version: "1.2",
              body: [
                { type: "TextBlock", text: titulo, weight: "Bolder", size: "Large", wrap: true },
                { type: "FactSet", facts: fatos },
                ...(descricao
                  ? [{ type: "TextBlock", text: descricao, wrap: true, isSubtle: true, size: "Small" }]
                  : []),
              ],
              actions: [
                {
                  type: "Action.OpenUrl",
                  title: "Abrir no SGA",
                  url: `${urlDoApp()}/solicitacoes`,
                },
              ],
            },
          },
        ],
      }),
    });
    if (!resposta.ok) {
      console.error("[teams] webhook respondeu", resposta.status, await resposta.text());
    }
  } catch (erro) {
    console.error("[teams] falha ao chamar o webhook:", erro);
  }
}
