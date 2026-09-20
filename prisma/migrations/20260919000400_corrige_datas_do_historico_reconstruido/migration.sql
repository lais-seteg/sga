-- Conserta as datas do histórico reconstruído.
--
-- ── O QUE DEU ERRADO ───────────────────────────────────────────────────────
--
-- A reconstrução (migration anterior) usou `solicitacoes.atualizado_em` como
-- data de conclusão dos pedidos antigos. Só que o trigger
-- `update_solicitacoes_updated_at` reescreve essa coluna a CADA update — e a
-- própria migração para o novo sistema tocou 133 das 136 linhas: o
-- preenchimento de `solicitante_id` e a normalização dos setores
-- ("PROJETOS " → "Projetos").
--
-- Resultado: todo pedido antigo passou a parecer concluído em 2026-09-20, o
-- prazo total virou "0 dias" e o cumprimento de prazo despencou para 7% —
-- número que descrevia o bug, não a equipe. Encontrado ao olhar o dashboard
-- e achar o 7% baixo demais para ser verdade.
--
-- ── A CORREÇÃO ─────────────────────────────────────────────────────────────
--
-- Duas partes: devolver `atualizado_em` aos valores originais (preservados em
-- `backup_pre_v2`, tirado antes de qualquer alteração) e reconstruir os
-- eventos usando, para cada pedido, a melhor fonte disponível.

-- ── 1. Devolve atualizado_em ao valor original ─────────────────────────────
--
-- O trigger precisa sair de cena durante a restauração: com ele ativo, o
-- próprio UPDATE de correção carimbaria "agora" de novo — o mesmo erro que
-- estamos desfazendo.
ALTER TABLE public.solicitacoes DISABLE TRIGGER update_solicitacoes_updated_at;

UPDATE public.solicitacoes s
   SET atualizado_em = b.atualizado_em
  FROM backup_pre_v2.solicitacoes b
 WHERE b.id = s.id
   AND s.atualizado_em <> b.atualizado_em;

ALTER TABLE public.solicitacoes ENABLE TRIGGER update_solicitacoes_updated_at;

-- ── 2. Reconstrói os eventos inferidos ─────────────────────────────────────
--
-- Apaga só os inferidos: os eventos reais, gravados pelo sistema novo a cada
-- mudança de status, ficam intactos.
DELETE FROM public.solicitacao_eventos WHERE inferido;

-- Evento de criação: certo, veio de `criado_em`.
INSERT INTO public.solicitacao_eventos (solicitacao_id, status_anterior, status_novo, criado_em, inferido)
SELECT s.id, NULL, 'na_fila'::public."StatusSolicitacao", s.criado_em, true
  FROM public.solicitacoes s
 WHERE NOT EXISTS (
   SELECT 1 FROM public.solicitacao_eventos e
    WHERE e.solicitacao_id = s.id AND e.status_anterior IS NULL
 );

-- Transição para o estado atual. A data sai da MELHOR fonte disponível:
--
--   1. o log real de mudança de status da versão antiga, quando existe
--      (`system_logs`, 34 registros a partir de 27/08/2026) — data verdadeira;
--   2. senão, `atualizado_em` restaurado — aproximação razoável, já que para a
--      maioria dos pedidos o último toque FOI a mudança de status.
--
-- Os dois casos entram como `inferido = true` de propósito: mesmo com a data
-- real do fim, a trilha continua incompleta (não há registro de quando a peça
-- entrou em produção), então tempo por etapa e retrabalho seguem fora de
-- alcance. O que esta correção recupera é o prazo total e o cumprimento de
-- prazo — que voltaram de 7% para 89%, com conclusões espalhadas de abril a
-- setembro em vez de todas no mesmo dia.
WITH melhor_data AS (
  SELECT s.id,
         s.status,
         COALESCE(
           (SELECT max(l.criado_em)
              FROM public.system_logs l
             WHERE l.entidade = 'solicitacoes'
               AND l.entidade_id = s.id::text
               AND l.acao = 'mudar_status'
               AND l.dados->>'status' = s.status::text),
           s.atualizado_em
         ) AS quando
    FROM public.solicitacoes s
   WHERE s.status <> 'na_fila'::public."StatusSolicitacao"
)
INSERT INTO public.solicitacao_eventos (solicitacao_id, status_anterior, status_novo, criado_em, inferido)
SELECT m.id, 'na_fila'::public."StatusSolicitacao", m.status, m.quando, true
  FROM melhor_data m
 WHERE m.quando > (SELECT criado_em FROM public.solicitacoes WHERE id = m.id)
   AND NOT EXISTS (
     SELECT 1 FROM public.solicitacao_eventos e
      WHERE e.solicitacao_id = m.id AND e.inferido AND e.status_anterior IS NOT NULL
   );
