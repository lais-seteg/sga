-- Religa as 136 solicitações históricas às contas recém-criadas.
--
-- Até aqui o solicitante era um campo de texto que cada pessoa preenchia à
-- mão, sem login. O resultado é o que se espera de campo livre: a mesma
-- pessoa aparece como "LAICIA SOUSA NASCIMENTO", "LAICIA NASCIMENTO" e
-- "Laícia Sousa Nascimento". Não dá para casar por igualdade nem por
-- similaridade automática sem errar — "Juliana Vicente | Seteg" e
-- "JULIANA AQUINO" são duas pessoas diferentes, e um LIKE '%Juliana%' juntaria
-- as duas. Por isso o de-para abaixo é explícito, escrito a partir dos 19
-- valores distintos que existiam na tabela no momento da migração.
--
-- `btrim` porque alguns valores foram gravados com espaço no fim
-- ("FERNANDO SOUSA ", "Nadia Vieira ").

UPDATE public.solicitacoes s
   SET solicitante_id = u.id
  FROM (VALUES
    ('LAICIA SOUSA NASCIMENTO',    'rh@setegce.com'),
    ('Laícia Sousa Nascimento',    'rh@setegce.com'),
    ('LAICIA NASCIMENTO',          'rh@setegce.com'),
    ('JULIANA AQUINO',             'juliana.aquino@setegce.com'),
    ('Eveline Mesquita',           'eveline@setegce.com'),
    ('Eveline',                    'eveline@setegce.com'),
    ('Ricardo Silveira',           'ricardo@setegce.com'),
    ('FERNANDO SOUSA',             'fernando@setegce.com'),
    ('Fernando Sousa',             'fernando@setegce.com'),
    ('LIZABETH SILVA',             'lizabeth@setegce.com'),
    ('Cristina Nascimento',        'cristina@setegce.com'),
    ('MAIRA GLAUCIA',              'maira@setegce.com'),
    ('Carina Rodrigues',           'carina@setegce.com'),
    ('Juliana Vicente | Seteg',    'juliana@setegce.com'),
    ('LAIZE DOS SANTOS RODRIGUES', 'laize@setegce.com'),
    ('Nadia Vieira',               'nadia@setegce.com'),
    -- Conta criada depois da carga inicial, junto com este de-para.
    ('Laís Mendes',                'lais@setegce.com')
  ) AS mapa(nome_legado, email)
  JOIN public.usuarios u ON u.email = mapa.email
 WHERE btrim(s.solicitante_nome_legado) = mapa.nome_legado
   AND s.solicitante_id IS NULL;

-- Resultado: 133 de 136 religados.
--
-- Os 3 restantes ficam com solicitante_id NULL de propósito: "Henrique Lima"
-- (2) e "Liana Gomes" (1) não fazem mais parte da empresa e não terão conta.
-- Inventar dono para esses pedidos atribuiria o trabalho de alguém a outra
-- pessoa. Continuam no histórico, visíveis apenas para admin, exibindo o nome
-- guardado em `solicitante_nome_legado`.
--
-- Para adotar um desses pedidos depois (se a pessoa ganhar conta):
--   UPDATE public.solicitacoes SET solicitante_id = (
--     SELECT id FROM public.usuarios WHERE email = 'fulano@setegce.com'
--   ) WHERE btrim(solicitante_nome_legado) = 'Nome Como Foi Digitado';
