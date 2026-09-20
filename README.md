# SGA Seteg — Sistema de Solicitação de Peças Gráficas

Sistema interno para abrir, acompanhar e produzir pedidos de peças gráficas
(comunicados, posts, banners, cartazes, apresentações) dentro da Seteg.

**Sistema fechado**: só entra quem tem conta, com e-mail corporativo e senha.
Cada pessoa vê apenas as próprias solicitações; a equipe de produção (perfil
Admin) vê todas e move a fila.

Mesmo padrão do [ClockRView](https://github.com/SetegCE/0000-1-2026--clockrview):
Next.js App Router, TypeScript, Prisma e o 7Station Design System.

---

## Sumário

- [O que mudou na v2](#o-que-mudou-na-v2)
- [Stack](#stack)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Acesso e perfis](#acesso-e-perfis)
- [Modelo de dados](#modelo-de-dados)
- [Fluxo de status](#fluxo-de-status)
- [Indicadores](#indicadores)
- [Integrações](#integrações)
- [Deploy](#deploy)
- [Segurança](#segurança)

---

## O que mudou na v2

A versão 1 era uma página pública em Vite + JavaScript: qualquer pessoa com o
link via **todas** as solicitações da empresa, e um código de acesso único
liberava as ações de gestor. A v2 reescreve o sistema no padrão do ClockRView
e o fecha por conta.

| | v1 | v2 |
| --- | --- | --- |
| Front-end | Vite + JS puro, manipulação de DOM | Next.js 14 (App Router) + React + TypeScript |
| Acesso | Público; código único de gestor | E-mail e senha, obrigatório para tudo |
| Sessão | Token em `localStorage` | Cookie `httpOnly` assinado (JWT HS256), 12 h |
| Quem vê o quê | Todo mundo via tudo | Colaborador vê as suas; Admin vê todas |
| Autorização | Policies de RLS + RPC no banco | Servidor (`lib/session.ts` + route handlers) |
| Chaves de API | No bundle (`VITE_*`), visíveis no navegador | Só no servidor |
| Validação | `required` no HTML | HTML **e** servidor (`validacao.ts`) |
| Gerenciar acessos | `UPDATE` na mão no SQL Editor | Tela `/usuarios`, restrita a quem tem a permissão |
| Indicadores de produção | Não existiam | Dashboard em `/dashboard` |
| Projetos do formulário | API do Clockify, chamada pelo navegador | Planilha CLIENTES_ATIVOS importada para o banco |

Os **136 pedidos históricos foram preservados** e religados aos donos — ver
[Modelo de dados](#modelo-de-dados). A numeração de protocolo também continua
de onde parou: depois de `SOL-0151` vem `SOL-0152`.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end | Next.js 14 (App Router), React 18, TypeScript |
| Estilo | 7Station Design System (tokens + `ui-kit.tsx`), Tailwind para o reset |
| Banco | Supabase (PostgreSQL), acessado via Prisma |
| Sessão | `jose` (JWT HS256) em cookie `httpOnly` + `bcryptjs` |
| Fonte | Satoshi, servida pelo próprio site (`@font-face`) |
| Ícones | Bootstrap Icons (CDN, carregamento não bloqueante) |
| Integrações | Power Automate (Teams) |
| Hospedagem | Vercel |

O Supabase segue sendo o banco — o que mudou é o cliente. Antes o navegador
falava direto com o PostgREST usando a chave `anon`; agora quem fala com o
Postgres é o servidor Next.js, via Prisma.

---

## Estrutura do projeto

```
.
├── app/
│   ├── layout.tsx                  # Shell: fonte, ícones, barra lateral
│   ├── page.tsx                    # Redireciona para /solicitacoes
│   ├── login/                      # Tela de login (padrão 7Station)
│   ├── components/                 # PageLayout, Sidebar e o ui-kit compartilhado
│   ├── solicitacoes/               # Tela principal: KPIs, filtros, tabela, modais
│   │   ├── page.tsx                #   Server Component — consulta conforme o papel
│   │   ├── SolicitacoesClient.tsx  #   Tabela, filtros, paginação, ações
│   │   ├── NovaSolicitacaoModal.tsx#   Formulário das 11 seções
│   │   └── DetalheSolicitacao.tsx  #   Modal de detalhes
│   ├── dashboard/                  # Indicadores de produção (Admin)
│   ├── usuarios/                   # Gestão de Acessos (só quem tem a permissão)
│   └── api/
│       ├── auth/login|logout/      # Sessão
│       ├── solicitacoes/           # POST, PATCH status, DELETE, validação
│       ├── usuarios/               # POST, PATCH (inclui troca de senha)
│       └── (sem integrações externas — projetos vêm da tabela `projetos`)
├── lib/
│   ├── prisma.ts, token.ts, auth.ts, session.ts   # Banco e sessão
│   ├── rateLimit.ts                # Freio de força bruta no login
│   ├── statusSolicitacao.ts        # Os quatro status, rótulos e cores
│   ├── solicitacaoListas.ts        # Setores, tipos de material, canais
│   ├── politicaConta.ts            # Regras de nome, e-mail e senha
│   ├── protocolo.ts                # Gera SOL-0152, SOL-0153...
│   ├── projetos.ts                 # Lista do autocomplete (planilha → banco)
│   ├── indicadores.ts              # Cálculo dos tempos, retrabalho e prazos
│   ├── log.ts, teams.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/                 # Migração da v1 para a v2
├── scripts/
│   ├── seed-usuarios.js            # Carga inicial de contas
│   └── importar-projetos.js        # Importa a planilha CLIENTES_ATIVOS
├── secrets/                        # Credenciais — fora do git (ver abaixo)
├── public/                         # Logo, favicon, fontes Satoshi
├── middleware.ts                   # Porteiro de rotas
└── doc/                            # Documento de referência do formulário
```

---

## Como rodar localmente

Requer Node.js 20+.

```bash
npm install
cp .env.example .env    # preencha DATABASE_URL, DIRECT_URL e JWT_SECRET
npm run dev             # http://localhost:3000
```

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm run build` | Gera o Prisma Client e compila para produção |
| `npm run seed:usuarios` | Cadastra contas a partir de `secrets/usuarios-iniciais.json` |
| `npx prisma studio` | Abre o navegador de dados do Prisma |

---

## Variáveis de ambiente

Ficam em `.env`, que está no `.gitignore` e **não deve ser commitado**. Os
nomes e o que cada uma faz estão em `.env.example`.

| Variável | Para quê | Sem ela |
| --- | --- | --- |
| `DATABASE_URL` | Postgres do Supabase, via pooler (porta 6543) | O sistema não sobe |
| `DIRECT_URL` | Conexão direta (porta 5432), usada pelo `prisma migrate` | Migrations não rodam |
| `JWT_SECRET` | Assina o cookie de sessão | O boot falha de propósito |
| `TEAMS_WEBHOOK_URL` | Card de notificação no Teams | A notificação não sai |
| `APP_URL` | Link do botão "Abrir no SGA" no card | Cai para `VERCEL_URL` |

> Nenhuma dessas variáveis chega ao navegador. Não existe mais prefixo
> `VITE_`: todo acesso externo acontece dentro de route handlers.

### A pasta `secrets/`

`secrets/` guarda o que não pode entrar no git: hoje, o
`usuarios-iniciais.json` com nome, e-mail, perfil e senha inicial de cada
pessoa, lido por `npm run seed:usuarios`. O `.gitignore` ignora
`secrets/*` com exceção do `README.md` explicativo.

No banco a senha vira hash bcrypt (custo 10) e não há como voltar atrás. Para
trocar a senha de alguém depois do primeiro seed, use a tela `/usuarios` — não
o script, que é idempotente e **pula** quem já existe justamente para nunca
desfazer uma troca de senha feita pela tela.

---

## Acesso e perfis

São dois perfis, e só dois:

| Perfil | Pode |
| --- | --- |
| **Colaborador** | Abrir solicitação e acompanhar **as suas** |
| **Admin** | Tudo isso, mais: ver todas as solicitações, mover a fila, excluir e abrir os indicadores |

Hoje o perfil Admin é de **Eveline Andrade Mesquita** e **Raissa Caroline Dias
Ferreira** — as mesmas duas pessoas que tinham o perfil "gestor" na v1. As
outras 38 contas são de colaborador.

### A permissão de gerenciar acessos

Mexer em contas (criar, trocar senha, desativar) **não** é parte do perfil
Admin: é a permissão `gerenciaAcessos`, marcada por pessoa. Hoje só a
**Eveline** a tem — a Raissa é Admin da produção e não enxerga a tela
`/usuarios`.

É um flag por conta, e não um terceiro perfil nem um e-mail cravado no código,
para que a responsabilidade possa mudar de mãos com um clique na própria tela.
Duas travas protegem a porta de trancar por dentro: ninguém remove a própria
permissão, e a permissão só existe sobre uma conta Admin (rebaixar alguém a
colaborador a retira junto).

A regra "cada solicitante só vê as suas" é aplicada na **consulta ao banco**
(`app/solicitacoes/page.tsx`), não na tela. Se fosse um filtro no cliente, os
pedidos das outras pessoas ainda teriam sido enviados ao navegador e estariam
legíveis no payload da página.

Um admin não consegue desativar a própria conta nem remover o próprio perfil
de administrador: se fosse o último, o sistema ficaria sem ninguém capaz de
gerenciar acessos e só um acesso direto ao banco destravaria.

### Cadastrar, editar ou desativar alguém

Pela tela **Gestão de Acessos** (`/usuarios`). O e-mail **não** é editável: ele
é a identidade da conta e o dono de todas as solicitações já abertas por ela —
trocá-lo transferiria o histórico de uma pessoa para outra em silêncio. Para
substituir alguém, desative a conta e crie outra.

Desativar não apaga: as solicitações continuam no histórico, ligadas à pessoa.

---

## Modelo de dados

Três tabelas, em `prisma/schema.prisma`.

**`usuarios`** — nome, e-mail (único), hash da senha, papel, ativo, setor,
último acesso.

**`solicitacoes`** — os campos das 11 seções do formulário, mais:

| Campo | Observação |
| --- | --- |
| `protocolo` | `SOL-0152`, da sequence `solicitacoes_id_seq`, contínua com a v1 |
| `solicitante_id` | FK para `usuarios`. É o que implementa "só vê as suas" |
| `solicitante_nome_legado` | O nome **digitado à mão** na v1, quando não havia login |
| `status` | Enum `StatusSolicitacao` — o banco recusa valor fora da lista |

**`system_logs`** — auditoria de criação, mudança de status e exclusão.
Gravação "melhor esforço": se o log falhar, a ação não falha junto.

### O histórico da v1

Os 136 pedidos anteriores foram preservados. Como o solicitante era um campo
de texto livre, a mesma pessoa aparecia como `LAICIA SOUSA NASCIMENTO`,
`LAICIA NASCIMENTO` e `Laícia Sousa Nascimento`. A migração
`20260919000100_religa_historico_ao_solicitante` liga cada pedido ao dono por
um de-para **explícito** — casar por similaridade juntaria "Juliana Vicente" e
"JULIANA AQUINO", que são duas pessoas.

- **133 pedidos** ficaram ligados a uma conta;
- **3 pedidos** (`Henrique Lima`, 2, e `Liana Gomes`, 1) ficaram sem dono:
  essas pessoas não fazem mais parte da empresa e não terão conta. Continuam
  no histórico, visíveis **apenas para Admin**, exibindo o nome guardado.
  Inventar um dono seria atribuir o trabalho de alguém a outra pessoa.

Para adotar um desses pedidos, se a pessoa ganhar conta:

```sql
UPDATE public.solicitacoes SET solicitante_id = (
  SELECT id FROM public.usuarios WHERE email = 'fulano@setegce.com'
) WHERE btrim(solicitante_nome_legado) = 'Nome Como Foi Digitado';
```

### Tabelas de apoio

| Tabela | O que é |
| --- | --- |
| `backup_pre_v2.*` (schema separado) | Cópia das tabelas antes da migração, tirada em 19/09/2026 |
| `usuarios_codigos_legado`, `sessoes_legado`, `codigos_acesso_legado` | O esquema de login por código da v1, renomeado |

Nada disso é lido pelo sistema. Podem ser derrubados com `DROP` depois que a
v2 estiver validada em produção.

---

## Fluxo de status

```
Na Fila
  ↓ equipe pega
Em Andamento            → tempo de ELABORAÇÃO
  ↓ entrega para avaliação
Aguardando Aprovação    → tempo AGUARDANDO O SOLICITANTE
  ↓ aprovou        ↘ pediu ajuste
  ↓                 Ajuste Pendente → conta RETRABALHO
  ↓                      ↓ volta para Em Andamento
Aprovado                → tempo APROVAÇÃO → FINALIZAÇÃO
  ↓
Finalizado
```

| Status | Rótulo na tela | Cor | Significado |
| --- | --- | --- | --- |
| `na_fila` | Na Fila | amarelo | Aguardando a equipe pegar |
| `em_andamento` | Em Andamento | laranja | Em produção |
| `aguardando_aprovacao` | Aguardando Aprovação | cinza | Entregue; com o solicitante |
| `ajustes` | Ajuste Pendente | azul | Solicitante pediu mudança |
| `aprovado` | Aprovado | verde-claro | Aprovado; fechando arquivos |
| `concluido` | Finalizado | verde | Concluído e entregue |

Toda solicitação nasce em `na_fila`, e isso é garantido no servidor: o status
não é aceito do corpo da requisição na criação. Só Admin move a fila — sem
isso, um solicitante marcaria o próprio pedido como "Finalizado".

**Os dois estados do meio existem por causa dos indicadores.** Sem um estado
que signifique "entreguei, a bola está com o solicitante", não há como separar
tempo de produção de tempo de espera — e era exatamente isso que o PMO pediu
para medir. O mesmo vale para `aprovado`: sem ele, "tempo entre aprovação e
finalização" não teria começo.

Na tabela, cada linha mostra o **próximo passo** em destaque e um menu
"Mover para" com todos os estados. O menu é válvula de escape deliberada: o
caminho não é travado, porque um clique errado não pode deixar a peça presa
num estado sem volta.

### Histórico de etapas

Cada mudança de estado grava uma linha em `solicitacao_eventos` — com origem,
destino, autor e instante — na **mesma escrita** que atualiza a solicitação.
Se fossem dois comandos, uma falha no meio deixaria o estado sem o evento, e
os indicadores sairiam errados em silêncio.

Esse histórico não fica só no dashboard. Em cada solicitação:

- a **coluna Tempo** na tabela mostra o tempo total (peça entregue, em verde)
  ou o tempo corrido desde a abertura (peça em aberto) — e em **vermelho**
  quando o pedido já passou do prazo limite sem ser entregue, que é a forma de
  a lista avisar sozinha sem ninguém comparar datas de cabeça;
- o **modal de detalhes** traz a data de abertura, a de finalização (**com o
  nome de quem finalizou**), o tempo total e uma **linha do tempo** com cada
  mudança de status: quando, **por quem**, e quanto tempo a peça ficou naquela
  etapa. É o "de onde veio esse número" — quando uma peça demora, a pergunta
  seguinte é sempre "demorou onde?", e logo depois "quem moveu isso?".

O autor de cada passo vem da conta que fez a ação, não de um campo digitado:
se a Raissa marcar como Finalizado, é o nome dela que fica registrado, e não
há como atribuir a ação a outra pessoa.

Nos registros herdados da v1, a linha do tempo marca as datas como
*aproximadas*, pelo mesmo motivo explicado em [Indicadores](#indicadores).

---

## Indicadores

Em `/dashboard`, visível para o perfil **Admin** (Eveline e Raissa). Seis
indicadores, com filtro de período:

| Indicador | Como é medido |
| --- | --- |
| **Prazo total da demanda** | Da abertura até a primeira vez que chegou em Finalizado |
| **Tempo de elaboração** | Soma dos intervalos em *Em Andamento* |
| **Aguardando o solicitante** | Soma dos intervalos em *Aguardando Aprovação* |
| **Aprovação → finalização** | Soma dos intervalos em *Aprovado* |
| **Retrabalho** | Quantas vezes a peça entrou em *Ajuste Pendente*, e o % de peças que voltaram |
| **Cumprimento de prazo** | Data de conclusão × `prazo_limite` (e × `prazo_ideal`) |

Mais a composição do tempo médio por etapa, a divisão entre entregues no prazo
e atrasadas, e um recorte por setor solicitante.

### Duas decisões que moldam os números

**Mediana ao lado da média.** Tempo de atendimento tem cauda longa: um único
pedido que ficou dois meses parado puxa a média e faz o indicador descrever o
outlier, não a rotina. A mediana responde "como é um pedido típico"; a média,
"qual o custo total". O painel mostra a mediana em destaque e a média embaixo.

**O que não dá para medir fica de fora, e o painel diz isso.** Os 136 pedidos
herdados da v1 não têm trilha de etapas — só data de abertura e de conclusão.
Eles entram em prazo total e cumprimento de prazo, e ficam **fora** dos tempos
por etapa e do retrabalho: uma trilha reconstruída não sabe quando a peça
entrou em produção nem quantas vezes voltou, e contá-la como "zero
retrabalhos" diluiria o indicador sobre casos em que ele é desconhecido. Um
aviso no topo do dashboard informa sobre quantos casos cada número fala.

> **Sobre as datas do histórico reconstruído:** a conclusão dos pedidos antigos
> foi recuperada do log real de mudança de status quando existia (34 casos, a
> partir de 27/08/2026) e, nos demais, aproximada por `atualizado_em`. Houve um
> tropeço aqui durante a migração — as atualizações administrativas dispararam
> o trigger de `atualizado_em` e carimbaram 133 registros com a data de hoje,
> derrubando o cumprimento de prazo para 7%. As datas originais foram
> restauradas a partir de `backup_pre_v2` (ver a migration
> `20260919000400_corrige_datas_do_historico_reconstruido`), e o indicador
> voltou a 89%.

---

## Integrações

**Projetos e clientes** — o autocomplete de "Código do Projeto | Cliente" é
alimentado pela tabela `projetos`, espelho da planilha **CLIENTES_ATIVOS**
mantida pelo PMO. Não há integração externa nem chave de API: a lista está no
banco, que tanto o ambiente local quanto a Vercel já enxergam.

Para atualizar depois que a planilha mudar, exporte-a como CSV e rode:

```bash
npm run importar:projetos -- "C:caminhoCLIENTES_ATIVOS.csv"
npm run importar:projetos -- --simular   # mostra o que faria, sem gravar
```

Sem argumento, o script procura o arquivo em `~/Downloads`. A importação é
uma transação só: ou o banco fica idêntico à planilha, ou fica como estava.
Projeto que sai da planilha sai do autocomplete, mas as solicitações que já
apontam para ele não são afetadas — o código é gravado como texto, sem chave
estrangeira, justamente para o histórico não depender de uma lista que muda.

**Teams (Power Automate)** — dispara um card a cada nova solicitação e a cada
mudança de status. A chamada acontece **depois** da gravação: se o webhook
falhar, o pedido continua salvo e ninguém vê erro.

---

## Deploy

Publicado na Vercel, com deploy a cada push na `main`.

Ao migrar da v1, confira estes três pontos nas configurações do projeto:

1. **Root Directory** — precisa ser a raiz do repositório (a v1 buildava
   dentro de `frontend/`, pasta que não existe mais).
2. **Framework Preset** — Next.js (o `vercel.json` já declara).
3. **Environment Variables** — cadastre as da tabela acima. As antigas
   `VITE_*` podem ser removidas: não são mais lidas por nada.

> A região do banco é `sa-east-1` (São Paulo). Vale apontar as funções da
> Vercel para `gru1` em Settings → Functions, para a latência não atravessar
> o Atlântico a cada consulta.

---

## Segurança

**O que a v2 resolveu**

- **O sistema deixou de ser público.** Toda rota passa pelo `middleware.ts`, e
  cada página e rota de API repete a checagem com o banco.
- **O PostgREST foi fechado.** A chave `anon` do Supabase é pública por
  natureza e esteve embutida no bundle da v1 — ela continua existindo e
  válida. A migração derrubou todas as policies e revogou os `GRANT` de `anon`
  e `authenticated`: com RLS ligado e nenhuma policy, aquela chave não lê mais
  nada. Sem esse passo, o login novo seria contornável pela API REST antiga.
- **A sessão saiu do `localStorage`** e virou cookie `httpOnly` — um XSS não
  consegue mais roubá-la.
- **A chave que ia no navegador acabou.** A do Clockify deixou de existir com
  a integração; a do Teams passou a ser usada só no servidor.
- **A senha nunca trafega de volta.** O hash não sai do servidor: a tela
  `/usuarios` usa `select` explícito justamente para o `senhaHash` não entrar
  no payload da página.
- **Força bruta tem freio** (`lib/rateLimit.ts`): 5 tentativas erradas por
  IP + e-mail bloqueiam por 5 minutos. Login com e-mail inexistente, conta
  inativa e senha errada devolvem a **mesma** mensagem — diferenciar diria a
  quem tenta adivinhar quais e-mails têm conta.
- **Validação no servidor**, não só no formulário.

**O que ainda merece atenção**

- **Rotacione o webhook do Teams.** Ele esteve em `script.js` versionado e
  segue no histórico do git; tirá-lo do código não o invalida. A antiga chave
  do Clockify também está no histórico — como a Seteg não usa mais o serviço,
  o ideal é revogá-la na conta em vez de só ignorá-la.
- **As senhas iniciais foram definidas fora do sistema** e trafegaram em texto
  puro até chegarem aqui. Vale pedir que cada pessoa troque a sua pela
  `/usuarios`, ou trocá-las em lote.
- **O freio de força bruta é por processo.** Vive na memória do Node, então
  reiniciar zera os contadores e várias instâncias da Vercel não compartilham
  estado. Freia tentativa trivial, não um atacante determinado.
- **A política de senha é só de comprimento** (mínimo 6). O piso é 6, e não 8,
  porque uma das senhas da carga inicial tem 7 caracteres — subir o mínimo
  tornaria aquela conta impossível de reeditar pela própria tela.

---

© Seteg – Soluções Geológicas e Ambientais • Versão 2.0.0
