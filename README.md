# SGPG Seteg — Sistema de Solicitação de Peças Gráficas

Painel web para abrir, acompanhar e gerenciar pedidos de peças gráficas
(comunicados, posts, banners, cartazes, apresentações etc.) dentro da Seteg.

Quem solicita preenche um formulário em diálogo e acompanha o andamento na
tabela; quem gerencia entra com um código de acesso e passa cada pedido pelos
estados de produção.

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como rodar localmente](#como-rodar-localmente)
- [Configuração e integrações](#configuração-e-integrações)
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

- **Acesso por código** — o botão `Gestor` no topo valida um código de
  segurança interno pela função `validar_codigo_acesso` do Supabase.
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
- **Notificação no Teams** — cada nova solicitação dispara um card via Power
  Automate.

---

## Stack

Sem build, sem framework, sem `node_modules`: são três arquivos servidos
estaticamente.

| Camada | Tecnologia |
| --- | --- |
| Front-end | HTML + CSS + JavaScript (ES6+), sem bundler |
| Banco e API | [Supabase](https://supabase.com) (PostgreSQL + PostgREST + RPC) |
| Fonte | Satoshi, servida pelo próprio site via `@font-face` |
| Ícones | Font Awesome 6.4 (CDN) + SVG inline |
| Integrações | Clockify (projetos), Power Automate (Teams) |
| Hospedagem | Vercel (estático) |

O cliente do Supabase (`vendor/supabase.js`, v2.112.3) é servido pelo próprio
site em vez de CDN, e carregado no fim do `<body>` para não bloquear a
renderização.

---

## Estrutura do projeto

```
.
├── index.html          # Marcação: header, cards, tabela e os três modais
├── styles.css          # Estilos, tokens de tema (claro/escuro) e responsivo
├── script.js           # Toda a lógica: Supabase, filtros, modais, integrações
├── vendor/
│   └── supabase.js     # Cliente do Supabase (local, não CDN)
├── fonts/              # Satoshi (@font-face)
├── images/             # Logo e favicon
├── doc/                # Documento de referência do formulário (.docx)
└── vercel.json         # Configuração de deploy estático
```

Os três modais em `index.html`:

| ID | O que é |
| --- | --- |
| `modalFormOverlay` | Formulário de nova solicitação |
| `modalLoginOverlay` | Acesso do gestor |
| `modalViewOverlay` | Detalhes da solicitação |

---

## Como rodar localmente

O projeto é estático, mas **precisa ser servido por HTTP** — abrir o
`index.html` direto pelo `file://` quebra as chamadas ao Supabase e ao
Clockify.

```bash
# Python
python -m http.server 5500

# Node
npx serve .
```

Depois abra `http://localhost:5500`.

---

## Configuração e integrações

As chaves ficam no topo do `script.js`:

| Constante | Para quê |
| --- | --- |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Banco das solicitações e validação do código de acesso |
| `CLOCKIFY_API_KEY` / `CLOCKIFY_BASE_URL` | Autocomplete de projeto/cliente |
| `TEAMS_WEBHOOK_URL` | Card de nova solicitação no Teams, via Power Automate |

**Clockify** — os projetos são buscados apenas quando alguém abre o
formulário ou começa a digitar no campo de projeto (`garantirProjetosClockify`
guarda a promessa e reaproveita o resultado durante a sessão).

**Teams** — a notificação é disparada depois que a solicitação é gravada; se
o webhook falhar, o pedido continua salvo.

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

Função RPC usada: `validar_codigo_acesso(codigo_input)` — devolve se o código
do gestor é válido.

---

## Fluxo de status

| Status no banco | Rótulo na tela | Cor |
| --- | --- | --- |
| `na_fila` | Na Fila | amarelo |
| `em_andamento` | Em Andamento | laranja |
| `ajustes` | Ajuste Pendente | azul |
| `concluido` (ou `finalizado`) | Finalizado | verde |

Toda solicitação nasce em `na_fila`. Só o gestor muda o status.

---

## Deploy

Publicado na Vercel como site estático (`vercel.json` com `@vercel/static`).
Cada push na branch `main` gera um novo deploy.

---

## Segurança

- A `SUPABASE_ANON_KEY` é pública por natureza — a proteção real precisa
  estar nas *Row Level Security policies* do Supabase, não no front-end.
- **Atenção:** `CLOCKIFY_API_KEY` e `TEAMS_WEBHOOK_URL` estão no
  `script.js`, que é servido ao navegador e versionado em repositório
  público. Quem abrir o código-fonte da página consegue lê-los. O caminho
  correto é movê-los para uma função serverless (Vercel Functions) que faça
  as chamadas do lado do servidor, e rotacionar as credenciais que já foram
  expostas.
- O código de acesso do gestor é compartilhado e validado no banco; ele
  controla a interface, não o acesso aos dados — as permissões de leitura e
  escrita continuam sendo responsabilidade das políticas do Supabase.

---

© Seteg – Soluções Geológicas e Ambientais • Versão 1.0.0
