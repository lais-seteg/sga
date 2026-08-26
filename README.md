# SGA Seteg — Sistema de Solicitação de Peças Gráficas

Painel web para abrir, acompanhar e gerenciar pedidos de peças gráficas
(comunicados, posts, banners, cartazes, apresentações etc.) dentro da Seteg.

Quem solicita preenche um formulário em diálogo e acompanha o andamento na
tabela; quem gerencia entra com um código de acesso individual e passa cada
pedido pelos estados de produção.

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Integrações](#integrações)
- [Acesso](#acesso)
- [Modelo de dados](#modelo-de-dados)
- [Fluxo de status](#fluxo-de-status)
- [Deploy](#deploy)
- [Segurança](#segurança)

---

## Funcionalidades

**Para quem solicita**

- **Nova solicitação em popup** — o botão `Nova Solicitação` abre um diálogo
  modal com as 11 seções do formulário. Fecha no `X`, no `Esc` ou clicando
  fora.
- **Autocomplete de projeto/cliente** — o campo *Código do Projeto | Cliente*
  busca os projetos do Clockify. A lista é carregada sob demanda (no máximo
  uma vez por sessão) e não pesa no carregamento inicial da página.
- **Campos condicionais** — justificativa de urgência, tipo "outro",
  formato "outros" e diretório de identidade visual só aparecem quando fazem
  sentido.
- **Validação antes do envio** — os campos obrigatórios que faltam são
  apontados e a página rola até o primeiro deles.

**Para quem gerencia**

- **Acesso por código individual** — o botão `Gestor` no topo valida o código
  pela função `login_sga` do Supabase e devolve um token de sessão. O
  cabeçalho passa a mostrar o nome de quem entrou.
- **Ações de status direto na tabela** — Em Andamento, Ajuste Pendente,
  Finalizado e Excluir, como botões de ícone na coluna AÇÕES. O status atual
  fica destacado.

**Comuns**

- **Tabela com filtros** — pílulas por status, seletor de setor, busca por
  texto e paginação (10/20/50 por página).
- **KPIs na lateral** — total, na fila, em andamento, ajuste pendente e
  finalizado.
- **Detalhes em modal** — o "olhinho" abre a solicitação completa.
- **Tema claro/escuro** — alternado pelo botão no cabeçalho e lembrado entre
  as visitas.
- **Notificação no Teams** — cada nova solicitação e cada mudança de status
  disparam um card via Power Automate.
- **Auditoria** — criação, mudança de status e exclusão ficam registradas na
  tabela `system_logs`.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end | Vite + JavaScript (ES Modules), CSS puro — sem framework de UI |
| Banco e API | [Supabase](https://supabase.com) (PostgreSQL + PostgREST + RPC) |
| Fonte | Satoshi, servida pelo próprio site via `@font-face` |
| Ícones | Font Awesome 6.4 (CDN) + SVG inline |
| Integrações | Clockify (projetos), Power Automate (Teams) |
| Hospedagem | Vercel |

O cliente do Supabase vem do pacote npm `@supabase/supabase-js` e entra no
bundle — não há mais `vendor/` nem CDN para ele.

---

## Estrutura do projeto

Mesma organização do [SGC Seteg](https://github.com/lais-seteg/sgc-seteg): a
aplicação inteira mora em `frontend/`, e a raiz guarda só o que é do
repositório (documentos, espelhamento, deploy).

```
.
├── .github/
│   └── workflows/
│       └── espelhar.yml        # Espelha o repo para SetegCE
├── doc/                        # Documento de referência do formulário (.docx)
├── frontend/
│   ├── .env                    # Chaves reais — NÃO versionado
│   ├── .env.example            # Modelo, com o que cada variável faz
│   ├── .gitignore
│   ├── index.html              # Marcação: header, cards, tabela e os três modais
│   ├── package.json
│   ├── vite.config.js
│   ├── vercel.json
│   ├── public/
│   │   └── assets/
│   │       ├── fonts/          # Satoshi (@font-face)
│   │       └── images/         # Logo e favicon
│   └── src/
│       ├── main.js             # Ponto de entrada: carrega CSS e app.js
│       ├── app.js              # Tela: tabela, filtros, modais, tema, paginação
│       ├── constants/
│       │   └── status.js       # Os quatro status válidos, labels e classes
│       ├── services/
│       │   ├── supabaseClient.js   # Instância única + token de sessão
│       │   ├── logService.js       # Auditoria em system_logs
│       │   ├── clockifyService.js  # Projetos para o autocomplete
│       │   └── teamsService.js     # Card de notificação no Teams
│       ├── modules/
│       │   ├── solicitacoes/
│       │   │   └── solicitacoesService.js  # Listar, criar, mudar status, excluir
│       │   └── usuarios/
│       │       └── usuariosService.js      # Login, logout, sessão
│       └── styles/
│           └── style.css       # Estilos, tokens de tema e responsivo
├── vercel.json                 # Aponta o build da raiz para frontend/
└── README.md
```

`src/app.js` cuida só da tela: nada ali fala com o Supabase, o Clockify ou o
Teams direto. As funções que o `index.html` chama por `onclick` são expostas
em `window` no fim do `app.js` — como o bundle é um módulo ES, elas não
seriam globais por conta própria.

Os três modais em `index.html`:

| ID | O que é |
| --- | --- |
| `modalFormOverlay` | Formulário de nova solicitação |
| `modalLoginOverlay` | Acesso do gestor |
| `modalViewOverlay` | Detalhes da solicitação |

---

## Como rodar localmente

Requer Node.js 18+.

```bash
cd frontend
npm install
cp .env.example .env   # preencha com as chaves reais
npm run dev            # http://localhost:3000
```

Outros comandos: `npm run build` (gera `dist/`) e `npm run preview`.

---

## Variáveis de ambiente

Ficam em `frontend/.env`, que está no `.gitignore` e **não deve ser
commitado**. Os nomes e o que cada uma faz estão em `frontend/.env.example`.

| Variável | Para quê |
| --- | --- |
| `VITE_SUPABASE_URL` | Projeto Supabase do SGA |
| `VITE_SUPABASE_ANON_KEY` | Chave publicável (anon) |
| `VITE_CLOCKIFY_API_KEY` | Autocomplete de projeto/cliente |
| `VITE_TEAMS_WEBHOOK_URL` | Card de notificação no Teams |

> Toda variável `VITE_*` é embutida no bundle durante o build e fica visível
> para quem abrir o site. Use apenas chaves de acesso público/leitura — nunca
> a `service_role` do Supabase. Ver a seção [Segurança](#segurança).

Sem `VITE_CLOCKIFY_API_KEY` o autocomplete deixa de sugerir; sem
`VITE_TEAMS_WEBHOOK_URL` a notificação deixa de sair. Nos dois casos o resto
do sistema funciona normalmente.

---

## Integrações

**Clockify** — os projetos são buscados apenas quando alguém abre o
formulário ou começa a digitar no campo de projeto (`garantirProjetosClockify`
guarda a promessa e reaproveita o resultado durante a sessão).

**Teams** — a notificação é disparada depois que a solicitação é gravada; se
o webhook falhar, o pedido continua salvo.

---

## Acesso

Cada pessoa que gerencia tem o **seu** código, guardado no banco como hash
bcrypt na tabela `usuarios`. Os dois perfis ativos são de gestor e fazem
exatamente as mesmas coisas:

| Nome | Perfil |
| --- | --- |
| Eveline Mesquita | Gestor |
| Raissa Dias | Gestor |

O fluxo:

1. A pessoa digita o código no modal `Gestor`.
2. A RPC `login_sga` (SECURITY DEFINER) compara o código contra o hash e,
   se bater, grava uma sessão de **12 horas** na tabela `sessoes` e devolve
   um token. Código errado leva meio segundo de atraso proposital, para
   desestimular tentativa em série.
3. O token fica no `localStorage` e o cliente Supabase o envia no cabeçalho
   `X-SGA-Token` em toda requisição.
4. As policies de `UPDATE` e `DELETE` chamam `sga_role_atual()`, que lê esse
   cabeçalho. **Sem sessão válida, o banco recusa — a checagem não é só de
   tela.**

A página sempre abre deslogada: qualquer token que tenha sobrado de uma
visita anterior é apagado no carregamento.

Para trocar um código ou cadastrar alguém:

```sql
-- novo acesso
insert into public.usuarios (nome, codigo_hash, role)
values ('Fulano de Tal', extensions.crypt('CODIGO-AQUI', extensions.gen_salt('bf')), 'gestor');

-- trocar o código de quem já existe
update public.usuarios
   set codigo_hash = extensions.crypt('NOVO-CODIGO', extensions.gen_salt('bf'))
 where nome = 'Fulano de Tal';

-- tirar o acesso sem apagar o histórico
update public.usuarios set ativo = false where nome = 'Fulano de Tal';
```

---

## Modelo de dados

Tabela `solicitacoes` no Supabase, com os campos principais:

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id`, `protocolo` | identificação | `protocolo` é o código exibido na tabela |
| `solicitante_nome`, `solicitante_setor`, `solicitante_cliente` | texto | seção 1 do formulário |
| `prazo_ideal`, `prazo_limite` | data | |
| `urgente`, `urgencia_justificativa` | booleano / texto | a justificativa só é gravada quando urgente |
| `tipo_material`, `tipo_material_outro` | texto | |
| `objetivo`, `conteudo`, `info_obrigatorias` | texto | |
| `formatos`, `formato_outros` | array / texto | canais de divulgação |
| `dimensoes`, `paginas` | texto / inteiro | |
| `identidade_visual`, `identidade_diretorio` | booleano / texto | |
| `referencias_diretorio`, `materiais_diretorio` | texto | |
| `observacoes` | texto | |
| `status` | texto | ver abaixo |
| `criado_em` | timestamp | ordena a listagem (mais recentes primeiro) |

Tabelas de apoio:

| Tabela | Para quê |
| --- | --- |
| `usuarios` | Nome, papel e hash do código de acesso. RLS ligado e **sem policy**: nenhum cliente lê ou escreve nela direto |
| `sessoes` | Token de sessão (guardado como sha256) e validade. Mesmas restrições |
| `system_logs` | Auditoria: criação, mudança de status e exclusão |

Funções RPC:

| Função | O que faz |
| --- | --- |
| `login_sga(p_codigo)` | Valida o código e abre a sessão |
| `logout_sga(p_token)` | Derruba a sessão |
| `sga_role_atual()` | Papel de quem está chamando, lido do `X-SGA-Token` |

---

## Fluxo de status

| Status no banco | Rótulo na tela | Cor |
| --- | --- | --- |
| `na_fila` | Na Fila | amarelo |
| `em_andamento` | Em Andamento | laranja |
| `ajustes` | Ajuste Pendente | azul |
| `concluido` (ou `finalizado`) | Finalizado | verde |

Toda solicitação nasce em `na_fila` — e o banco garante isso: a policy de
`INSERT` só aceita linha nova com esse status. Só quem tem sessão de gestor
muda o status depois.

---

## Deploy

Publicado na Vercel. O build roda dentro de `frontend/`:

```
npm run build   →   frontend/dist/
```

Há dois arquivos de configuração, e a Vercel lê **um** deles, conforme o
*Root Directory* do projeto:

| Root Directory | Arquivo lido |
| --- | --- |
| raiz do repositório (padrão atual) | `vercel.json` da raiz, que entra em `frontend/` e faz o build |
| `frontend` | `frontend/vercel.json`, no mesmo formato do SGC |

Qualquer uma das duas configurações funciona; a da raiz existe para o projeto
já publicado continuar buildando sem precisar mexer nas configurações da
Vercel. Cada push na branch `main` gera um novo deploy.

---

## Segurança

**O que está resolvido**

- O código de acesso **nunca sai do servidor**: é comparado dentro da RPC
  `login_sga`, contra um hash bcrypt. As tabelas `usuarios` e `sessoes` têm
  RLS ligado e nenhuma policy — não há como lê-las pelo PostgREST.
- A tabela `solicitacoes` deixou de ter a policy única `Allow all access`
  (que deixava qualquer visitante alterar e apagar). Agora são quatro, uma
  por comando:

  | Comando | Quem pode |
  | --- | --- |
  | `SELECT` | qualquer um — a tabela é a tela pública do sistema |
  | `INSERT` | qualquer um, mas a linha tem que nascer em `na_fila` |
  | `UPDATE` | só com sessão de gestor válida |
  | `DELETE` | só com sessão de gestor válida |

- A sessão expira em 12 horas e as expiradas são varridas a cada login.
- As chaves saíram do código-fonte e passaram para `frontend/.env`, fora do
  versionamento.

**O que ainda merece atenção**

- A `VITE_SUPABASE_ANON_KEY` é pública por natureza. A proteção real é a RLS
  descrita acima, não o segredo da chave.
- `VITE_CLOCKIFY_API_KEY` e `VITE_TEAMS_WEBHOOK_URL` continuam indo para o
  bundle: toda variável `VITE_*` é embutida no build e quem abrir o
  código-fonte da página consegue lê-las. Tirá-las do `.env` versionado
  resolve o histórico do repositório, não a exposição no navegador. O
  caminho correto é movê-las para uma função serverless (Vercel Functions)
  que faça as chamadas do lado do servidor.
- **Essas duas credenciais já estiveram em `script.js`, versionado em
  repositório.** Elas seguem no histórico do git. Rotacione as duas: gere
  uma nova API key no Clockify e um novo webhook no Power Automate.

---

© Seteg – Soluções Geológicas e Ambientais • Versão 1.1.0
