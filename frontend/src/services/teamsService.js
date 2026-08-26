/**
 * SGA SETEG - Sistema de Solicitação de Peças Gráficas
 * Ano: 2026
 * Empresa: SETEG
 *
 * Notificação no Teams via Power Automate.
 *
 * A chamada é disparada DEPOIS que a solicitação já foi gravada: se o
 * webhook falhar, o pedido continua salvo. Por isso nada aqui propaga erro.
 */

const TEAMS_WEBHOOK_URL = import.meta.env.VITE_TEAMS_WEBHOOK_URL;

export async function notificarTeams(titulo, fatos, descricao) {
  if (!TEAMS_WEBHOOK_URL) {
    console.warn("VITE_TEAMS_WEBHOOK_URL não configurada — notificação não enviada.");
    return;
  }
  try {
    const r = await fetch(TEAMS_WEBHOOK_URL, {
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
                  url: window.location.href,
                },
              ],
            },
          },
        ],
      }),
    });
    if (!r.ok) console.error("Teams webhook erro:", r.status, await r.text());
  } catch (err) {
    console.error("Teams webhook falha:", err);
  }
}
