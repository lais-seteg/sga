-- SGA v2 — de painel público com código de gestor a sistema fechado por
-- e-mail e senha.
--
-- Esta migration roda sobre um banco COM DADOS (136 solicitações, 53 linhas
-- de auditoria). Nada é apagado: as solicitações são preservadas e ganham um
-- dono; as tabelas do esquema de acesso antigo são renomeadas para *_legado
-- em vez de descartadas.
--
-- Quatro movimentos, nesta ordem:
--   1. Sai do caminho tudo que era do login por código (usuarios, sessoes,
--      codigos_acesso e as funções RPC).
--   2. Nasce a tabela `usuarios` de verdade, com e-mail e hash de senha.
--   3. `solicitacoes` ganha dono (solicitante_id) e o histórico é religado
--      por nome.
--   4. O PostgREST é fechado: sem policy, ninguém lê nada com a chave anon.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Esquema de acesso antigo sai de cena
-- ─────────────────────────────────────────────────────────────────────────

-- As policies vêm PRIMEIRO, antes das funções: `solicitacoes_update` e
-- `solicitacoes_delete` chamam `sga_role_atual()` no corpo, e o Postgres
-- recusa derrubar uma função de que uma policy depende (erro 2BP01). Esta
-- ordem também é a segura do ponto de vista de acesso — em nenhum instante
-- existe uma policy permissiva apontando para uma função que já sumiu.
DROP POLICY IF EXISTS solicitacoes_select ON public.solicitacoes;
DROP POLICY IF EXISTS solicitacoes_insert ON public.solicitacoes;
DROP POLICY IF EXISTS solicitacoes_update ON public.solicitacoes;
DROP POLICY IF EXISTS solicitacoes_delete ON public.solicitacoes;
DROP POLICY IF EXISTS system_logs_insert  ON public.system_logs;
DROP POLICY IF EXISTS "Bloquear acesso direto" ON public.codigos_acesso;

-- As RPC do login por código não têm mais para onde apontar depois que a
-- tabela `usuarios` muda de forma. Removidas explicitamente para não ficarem
-- como superfície exposta via PostgREST (SECURITY DEFINER, alcançáveis pela
-- chave anon, que é pública e está no bundle já publicado).
DROP FUNCTION IF EXISTS public.login_sga(text);
DROP FUNCTION IF EXISTS public.logout_sga(text);
DROP FUNCTION IF EXISTS public.sga_role_atual();
DROP FUNCTION IF EXISTS public.sessao_atual();
DROP FUNCTION IF EXISTS public.validar_codigo_acesso(text);

-- Renomeadas, não apagadas: guardam os códigos de acesso e as sessões do
-- modelo antigo. Não são mais lidas por nada. Podem ser derrubadas com um
-- DROP depois que a nova autenticação estiver validada em produção.
ALTER TABLE IF EXISTS public.usuarios       RENAME TO usuarios_codigos_legado;
ALTER TABLE IF EXISTS public.sessoes        RENAME TO sessoes_legado;
ALTER TABLE IF EXISTS public.codigos_acesso RENAME TO codigos_acesso_legado;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Papéis, status e a nova tabela de contas
-- ─────────────────────────────────────────────────────────────────────────

CREATE TYPE public."Papel" AS ENUM ('admin', 'colaborador');
CREATE TYPE public."StatusSolicitacao" AS ENUM ('na_fila', 'em_andamento', 'ajustes', 'concluido');

CREATE TABLE public.usuarios (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome             text NOT NULL,
    email            text NOT NULL,
    senha_hash       text NOT NULL,
    papel            public."Papel" NOT NULL DEFAULT 'colaborador',
    ativo            boolean NOT NULL DEFAULT true,
    setor            text,
    ultimo_acesso_em timestamptz,
    criado_em        timestamptz NOT NULL DEFAULT now(),
    atualizado_em    timestamptz NOT NULL DEFAULT now()
);

-- O e-mail é a identidade da conta: é por ele que o login procura e é ele que
-- o seed usa para decidir entre criar e pular. Sempre gravado em minúsculas
-- (normalizado na aplicação), e o unique garante que não haja duas contas
-- para a mesma pessoa.
CREATE UNIQUE INDEX usuarios_email_key ON public.usuarios (email);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. `solicitacoes`: dono, status tipado e limpeza de colunas mortas
-- ─────────────────────────────────────────────────────────────────────────

-- `arte_anterior` / `arte_anterior_diretorio` vieram de uma revisão anterior
-- do formulário e nunca receberam um único valor preenchido (conferido antes
-- de escrever esta migration: 0 linhas). `criado_por` idem — sempre NULL,
-- porque não havia login para preencher. Mantê-las seria carregar campo que
-- a tela não mostra e o código não escreve.
ALTER TABLE public.solicitacoes
    DROP COLUMN IF EXISTS arte_anterior,
    DROP COLUMN IF EXISTS arte_anterior_diretorio,
    DROP COLUMN IF EXISTS criado_por;

-- O nome digitado à mão vira explicitamente um campo de histórico. Renomear
-- (em vez de manter o nome antigo) deixa claro no schema que nenhum pedido
-- novo escreve aqui — o nome passa a vir da conta, pela FK abaixo.
ALTER TABLE public.solicitacoes RENAME COLUMN solicitante_nome TO solicitante_nome_legado;
ALTER TABLE public.solicitacoes ALTER COLUMN solicitante_nome_legado DROP NOT NULL;

ALTER TABLE public.solicitacoes
    ADD COLUMN solicitante_id uuid REFERENCES public.usuarios(id);

-- O Prisma modela estes campos como não-nulos (têm default). Conferido antes:
-- nenhuma linha existente está NULL em nenhum deles, então o SET NOT NULL não
-- tem como falhar.
ALTER TABLE public.solicitacoes
    ALTER COLUMN urgente           SET NOT NULL,
    ALTER COLUMN identidade_visual SET NOT NULL,
    ALTER COLUMN criado_em         SET NOT NULL,
    ALTER COLUMN atualizado_em     SET NOT NULL;

UPDATE public.solicitacoes SET formatos = '{}' WHERE formatos IS NULL;
ALTER TABLE public.solicitacoes
    ALTER COLUMN formatos SET DEFAULT '{}',
    ALTER COLUMN formatos SET NOT NULL;

-- Texto livre vira enum. Os três valores presentes hoje (na_fila,
-- em_andamento, concluido) já são rótulos válidos, então o USING converte
-- direto. O default precisa cair antes do ALTER TYPE e voltar depois — o
-- Postgres não recasta o default sozinho.
ALTER TABLE public.solicitacoes ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.solicitacoes
    ALTER COLUMN status TYPE public."StatusSolicitacao"
    USING (
        CASE status
            -- 'finalizado' era o rótulo antigo de 'concluido' e podia ter
            -- sobrado em registro velho; mapeado aqui para a conversão não
            -- estourar caso apareça.
            WHEN 'finalizado' THEN 'concluido'
            ELSE status
        END
    )::public."StatusSolicitacao";
ALTER TABLE public.solicitacoes
    ALTER COLUMN status SET DEFAULT 'na_fila',
    ALTER COLUMN status SET NOT NULL;

CREATE INDEX solicitacoes_solicitante_id_criado_em_idx
    ON public.solicitacoes (solicitante_id, criado_em);
CREATE INDEX solicitacoes_status_idx
    ON public.solicitacoes (status);

-- O trigger que preenchia `protocolo` quando vinha vazio continua no lugar,
-- e a sequence `solicitacoes_id_seq` (em 151) segue sendo a fonte do número
-- — agora chamada também pela aplicação, em lib/protocolo.ts. Nada a fazer
-- aqui além de não mexer: é o que mantém SOL-0152 vindo depois de SOL-0151.

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Auditoria
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.system_logs RENAME COLUMN created_at TO criado_em;
ALTER TABLE public.system_logs
    ADD COLUMN usuario_id uuid REFERENCES public.usuarios(id);
ALTER TABLE public.system_logs
    ALTER COLUMN dados SET DEFAULT '{}'::jsonb;
UPDATE public.system_logs SET dados = '{}'::jsonb WHERE dados IS NULL;
ALTER TABLE public.system_logs ALTER COLUMN dados SET NOT NULL;

CREATE INDEX system_logs_entidade_entidade_id_idx ON public.system_logs (entidade, entidade_id);
CREATE INDEX system_logs_criado_em_idx           ON public.system_logs (criado_em);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Fecha o PostgREST
-- ─────────────────────────────────────────────────────────────────────────
--
-- Este é o passo que efetivamente torna o sistema fechado, e o mais fácil de
-- esquecer. A chave `anon` do Supabase é pública por natureza e esteve
-- embutida no bundle da versão anterior — ela continua existindo e continua
-- válida. Enquanto a policy "SELECT para qualquer um" existir, qualquer
-- pessoa com aquela chave lê as 136 solicitações direto pela API REST, sem
-- passar pelo login que acabamos de construir.
--
-- Com RLS ligado e NENHUMA policy, `anon` e `authenticated` não enxergam
-- linha nenhuma. O Prisma não é afetado: conecta como `postgres`, dono das
-- tabelas, que não é submetido a RLS.
--
-- As policies em si já caíram no passo 1 (tinham de sair antes das funções
-- de que dependiam); aqui só se garante que o RLS está ligado em tudo — nas
-- tabelas novas inclusive, que nascem sem ele.
ALTER TABLE public.solicitacoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_codigos_legado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes_legado         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codigos_acesso_legado  ENABLE ROW LEVEL SECURITY;

-- Cinto e suspensório: além de RLS sem policy, tira o GRANT. Assim, mesmo que
-- alguém crie uma policy por engano num painel, a chave anon continua sem
-- privilégio sobre a tabela.
REVOKE ALL ON public.usuarios     FROM anon, authenticated;
REVOKE ALL ON public.solicitacoes FROM anon, authenticated;
REVOKE ALL ON public.system_logs  FROM anon, authenticated;
REVOKE ALL ON public.usuarios_codigos_legado FROM anon, authenticated;
REVOKE ALL ON public.sessoes_legado          FROM anon, authenticated;
REVOKE ALL ON public.codigos_acesso_legado   FROM anon, authenticated;

COMMIT;
