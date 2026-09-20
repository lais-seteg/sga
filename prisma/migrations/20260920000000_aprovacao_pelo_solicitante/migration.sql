-- Fecha o ciclo de aprovação com quem realmente decide: o solicitante.
--
-- Até aqui, "Aguardando Aprovação" dependia de o solicitante responder por
-- fora (telefone, conversa) e alguém da produção registrar na tela por ele.
-- Agora ele aprova (vai direto a Finalizado) ou pede ajuste — pela própria
-- tela, na própria solicitação.
--
-- A mudança de fluxo é toda em código (lib/statusSolicitacao.ts e a
-- autorização em app/api/solicitacoes/[id]/route.ts). O banco só precisa de
-- uma coisa: um lugar para guardar O QUE foi pedido.

-- Descrição dos ajustes, presa ao EVENTO e não à solicitação.
--
-- Um campo em `solicitacoes` guardaria só o último pedido de ajuste: a
-- segunda rodada apagaria o que foi pedido na primeira, e o histórico
-- perderia justamente a informação que explica por que a peça voltou duas
-- vezes. Preso ao evento, cada rodada mantém o seu texto — a linha do tempo
-- do modal de detalhes mostra o que foi pedido em cada uma, e a peça parada
-- em Ajuste Pendente exibe o pedido em aberto logo no topo.
ALTER TABLE public.solicitacao_eventos ADD COLUMN observacao text;

COMMENT ON COLUMN public.solicitacao_eventos.observacao IS
  'O que foi pedido nesta transição. Obrigatório ao mover para "ajustes"; nulo nas demais.';
