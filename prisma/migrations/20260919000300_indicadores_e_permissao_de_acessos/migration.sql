-- Dois pedidos da Seteg, aplicados juntos:
--   1. Gestão de Acessos deixa de ser "todo admin" e passa a ser permissão
--      própria — Eveline e Raissa são as duas admin da produção, mas só
--      Eveline mexe em contas.
--   2. Dashboard de indicadores, que exige registrar o histórico de etapas e
--      dois estados novos no fluxo.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Os dois estados novos do fluxo
-- ─────────────────────────────────────────────────────────────────────────
--
-- Em statements SEPARADOS e antes de tudo: um valor de enum recém-criado não
-- pode ser USADO na mesma transação que o criou (Postgres), então isto não
-- pode entrar no mesmo bloco das escritas mais abaixo.
--
-- Sem `aguardando_aprovacao` não existe como separar "tempo em que a equipe
-- trabalhou" de "tempo em que a peça ficou parada esperando o solicitante" —
-- que é exatamente um dos indicadores pedidos. E sem `aprovado`, "tempo entre
-- aprovação e finalização" não teria começo.
ALTER TYPE public."StatusSolicitacao" ADD VALUE IF NOT EXISTS 'aguardando_aprovacao' AFTER 'em_andamento';
ALTER TYPE public."StatusSolicitacao" ADD VALUE IF NOT EXISTS 'aprovado' AFTER 'ajustes';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Permissão de gerir acessos
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.usuarios
    ADD COLUMN gerencia_acessos boolean NOT NULL DEFAULT false;

UPDATE public.usuarios SET gerencia_acessos = true WHERE email = 'eveline@setegce.com';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Histórico de etapas
-- ─────────────────────────────────────────────────────────────────────────
--
-- Sem esta tabela não há como medir quanto tempo uma peça passou em cada
-- estágio: `solicitacoes` guarda só o estado ATUAL.
CREATE TABLE public.solicitacao_eventos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitacao_id  uuid NOT NULL REFERENCES public.solicitacoes(id) ON DELETE CASCADE,
    status_anterior public."StatusSolicitacao",
    status_novo     public."StatusSolicitacao" NOT NULL,
    usuario_id      uuid REFERENCES public.usuarios(id),
    -- true nos eventos RECONSTRUÍDOS dos 136 pedidos anteriores a esta tabela
    -- existir. O dashboard separa os dois: tempo por etapa só pode ser
    -- calculado sobre histórico real.
    inferido        boolean NOT NULL DEFAULT false,
    criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX solicitacao_eventos_solicitacao_idx
    ON public.solicitacao_eventos (solicitacao_id, criado_em);

ALTER TABLE public.solicitacao_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.solicitacao_eventos FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Reconstrução do histórico existente
-- ─────────────────────────────────────────────────────────────────────────
--
-- O evento de CRIAÇÃO é certo: toda solicitação nasceu em na_fila, na data
-- gravada em criado_em.
INSERT INTO public.solicitacao_eventos (solicitacao_id, status_anterior, status_novo, criado_em, inferido)
SELECT id, NULL, 'na_fila'::public."StatusSolicitacao", criado_em, true
  FROM public.solicitacoes;

-- Já a transição para o estado atual é uma APROXIMAÇÃO: usa atualizado_em,
-- que é a última vez que a linha foi tocada. Para um pedido cujo último toque
-- foi justamente a mudança de status (o caso normal), a data bate; para um
-- que sofreu outra edição depois, não. Daí `inferido = true`: o dashboard usa
-- esses eventos em prazo total e cumprimento de prazo, e os DESCARTA no
-- cálculo de tempo por etapa, onde a aproximação inventaria número.
INSERT INTO public.solicitacao_eventos (solicitacao_id, status_anterior, status_novo, criado_em, inferido)
SELECT id, 'na_fila'::public."StatusSolicitacao", status, atualizado_em, true
  FROM public.solicitacoes
 WHERE status <> 'na_fila'::public."StatusSolicitacao"
   AND atualizado_em > criado_em;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. O CHECK fantasma
-- ─────────────────────────────────────────────────────────────────────────
--
-- `status_valido` é herança da época em que `status` era texto livre, e
-- sobreviveu à conversão da coluna para enum (o ALTER TYPE não derruba
-- constraints — apenas revalidou o CHECK contra os valores existentes, que
-- passavam).
--
-- O resultado era uma regra fantasma: o enum aceitava os dois estados novos,
-- mas o CHECK, que só conhecia os quatro antigos, recusava a escrita com o
-- erro 23514 — e a tela mostrava um 500 genérico ao tentar marcar uma peça
-- como "Aguardando Aprovação". Encontrado testando o fluxo ponta a ponta.
--
-- Não há perda de garantia: o próprio tipo enum já impede qualquer valor fora
-- da lista, e passa a ser a única fonte da verdade sobre quais estados
-- existem.
ALTER TABLE public.solicitacoes DROP CONSTRAINT IF EXISTS status_valido;
