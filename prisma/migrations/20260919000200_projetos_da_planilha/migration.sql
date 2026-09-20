-- Tabela de projetos/clientes, que substitui a integração com o Clockify
-- como fonte do autocomplete de "Código do Projeto | Cliente".
--
-- A origem passou a ser a planilha CLIENTES_ATIVOS, mantida pelo PMO. A
-- planilha em si não pode ser a fonte em tempo de execução — ela vive no
-- computador de alguém, e em produção (Vercel) esse arquivo não existe. Então
-- ela é IMPORTADA para cá por `npm run importar:projetos`, e a aplicação
-- consulta esta tabela.

CREATE TABLE public.projetos (
    -- Código sem o "#" do começo (o "#" é enfeite da planilha): '0189-3-2025'.
    -- É a chave natural — é o que a pessoa digita e o que fica gravado em
    -- solicitacoes.solicitante_cliente.
    codigo   text PRIMARY KEY,
    cliente  text NOT NULL,
    segmento text,
    projeto  text,
    escopo   text,
    lider    text,
    vendedor text,
    acesso   text,
    -- Texto livre, como vem da planilha ('ATIVO', 'STAND BY'...). Não é enum
    -- de propósito: a planilha é mantida à mão e um valor novo ali não pode
    -- derrubar a importação inteira.
    status   text,

    -- Quando esta linha foi vista pela última vez numa importação. Serve para
    -- saber se a lista está velha sem precisar abrir a planilha.
    atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- A busca do autocomplete filtra por cliente e por nome do projeto.
CREATE INDEX projetos_cliente_idx ON public.projetos (cliente);

-- Mesma política das outras tabelas: RLS ligado, nenhuma policy, sem GRANT
-- para anon. Quem lê é o servidor, via Prisma, conectado como `postgres`.
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.projetos FROM anon, authenticated;
