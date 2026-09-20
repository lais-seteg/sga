-- Dois endurecimentos de segurança, sem custo de performance no uso diário.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Terceira camada de fechamento do PostgREST
-- ─────────────────────────────────────────────────────────────────────────
--
-- Os GRANTs de tabela já foram revogados na migração v2, e o RLS está ligado
-- sem nenhuma policy. Isto acrescenta a camada de baixo: sem USAGE no schema,
-- `anon` e `authenticated` não conseguem sequer referenciar um objeto de
-- `public`.
--
-- Por que três camadas para a mesma coisa: a chave `anon` é pública por
-- natureza e esteve embutida no bundle da v1 — ela existe, é válida e não tem
-- como ser despublicada. Se alguém criar uma policy por engano num painel, ou
-- um GRANT voltar numa restauração de backup, as outras camadas seguram.
--
-- O `ALTER DEFAULT PRIVILEGES` cobre o futuro: sem ele, uma tabela nova criada
-- depois desta migração poderia nascer com permissão para essas roles.
--
-- O Prisma não é afetado: conecta como `postgres`, dono do schema.
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Freio de força bruta que sobrevive ao serverless
-- ─────────────────────────────────────────────────────────────────────────
--
-- O contador anterior vivia num `Map` na memória do processo. Isso funcionava
-- quando o plano era um servidor Node único, mas o SGA roda na Vercel: cada
-- invocação pode cair numa instância nova, e o contador zerava a cada cold
-- start. Bastava espaçar as tentativas para nunca bater no limite — ou seja,
-- na prática o freio quase não existia, justamente no ambiente em que mais
-- importava.
--
-- Com senhas curtas e sem 2FA, essa era a folga mais perigosa do sistema.
-- No banco, o contador é um só para todas as instâncias.
--
-- Custo: duas consultas a mais no caminho do login, nenhuma em qualquer outra
-- tela. Login é operação rara.
CREATE TABLE public.tentativas_login (
    -- IP + e-mail. Chave composta de propósito: por e-mail sozinho, alguém de
    -- fora trancaria a conta de um colega; por IP sozinho, um escritório
    -- inteiro atrás do mesmo NAT se bloquearia junto.
    chave             text PRIMARY KEY,
    falhas            integer NOT NULL DEFAULT 0,
    primeira_falha_em timestamptz NOT NULL DEFAULT now(),
    bloqueado_ate     timestamptz,
    atualizado_em     timestamptz NOT NULL DEFAULT now()
);

-- Usado pela limpeza oportunista de registros vencidos (ver lib/rateLimit.ts).
CREATE INDEX tentativas_login_atualizado_em_idx ON public.tentativas_login (atualizado_em);

ALTER TABLE public.tentativas_login ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tentativas_login FROM anon, authenticated;
