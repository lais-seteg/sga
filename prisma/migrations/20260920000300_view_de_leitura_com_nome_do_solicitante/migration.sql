-- Uma view de LEITURA para quem abre o banco direto no painel do Supabase.
--
-- ── O problema que ela resolve ───────────────────────────────────────────
--
-- Em `solicitacoes`, quem pediu a peça é o `solicitante_id` — uma chave
-- estrangeira para `usuarios`. O nome não está guardado ali: ele vem da conta
-- que fez o login. No editor de tabelas do Supabase isso aparece como um UUID
-- e uma coluna `solicitante_nome_legado` vazia, o que dá a impressão errada de
-- que o pedido ficou sem dono.
--
-- ── Por que NÃO gravamos o nome na linha ─────────────────────────────────
--
-- Seria a saída óbvia, e é a errada. O nome gravado vira uma cópia que
-- envelhece: quando uma conta é renomeada — o que já aconteceu, "Laís Mendes"
-- virou "Laís Bizerra Mendes" — os pedidos antigos continuariam com o nome
-- velho, e as duas telas passariam a discordar. Com a chave estrangeira existe
-- uma única verdade, e ela é a conta.
--
-- A view dá a leitura conveniente sem criar a segunda cópia: o nome é
-- resolvido na hora da consulta, então acompanha qualquer renomeação.
--
-- ── `solicitante_nome_legado` ────────────────────────────────────────────
--
-- É o nome como foi DIGITADO na v1, quando não havia login. Só sobrevive nos
-- três pedidos de quem saiu da Seteg (Henrique Lima, Liana Gomes) e portanto
-- não tem conta para apontar. Em pedido novo ele é nulo de propósito.
-- O `coalesce` abaixo junta os dois mundos numa coluna só.

CREATE OR REPLACE VIEW public.vw_solicitacoes
-- `security_invoker` faz a view ser consultada com as permissões de quem
-- consulta, não com as do dono (`postgres`). Sem isso, a view viraria um
-- buraco por baixo de todo o fechamento do PostgREST feito nas migrações
-- anteriores: seria um objeto `SECURITY DEFINER` capaz de ler `solicitacoes`
-- em nome de qualquer um que alcançasse o schema.
WITH (security_invoker = on) AS
SELECT
    s.id,
    s.protocolo,

    -- O nome que interessa, venha da conta (caso normal) ou do histórico.
    COALESCE(u.nome, s.solicitante_nome_legado) AS solicitante,
    u.email                                     AS solicitante_email,
    -- Verdadeiro nos pedidos herdados da v1 sem conta correspondente.
    (s.solicitante_id IS NULL)                  AS solicitante_sem_conta,

    s.solicitante_setor,
    s.solicitante_cliente,
    s.status,
    s.tipo_material,
    s.objetivo,
    s.urgente,
    s.prazo_ideal,
    s.prazo_limite,
    s.criado_em,
    s.atualizado_em,

    -- Mantidos no fim para conferência: é para eles que se olha quando o
    -- vínculo parece errado.
    s.solicitante_id,
    s.solicitante_nome_legado
FROM public.solicitacoes s
LEFT JOIN public.usuarios u ON u.id = s.solicitante_id;

COMMENT ON VIEW public.vw_solicitacoes IS
    'Leitura das solicitações com o nome do solicitante já resolvido a partir da conta de login. Use no painel do Supabase; a aplicação lê as tabelas direto.';

-- Mesmo tratamento das tabelas: as roles públicas do PostgREST não enxergam.
REVOKE ALL ON public.vw_solicitacoes FROM anon, authenticated;
