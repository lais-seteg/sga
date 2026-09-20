# Pasta de segredos

Tudo aqui dentro está fora do git (ver `.gitignore`: `secrets/*` com exceção
deste README). É onde ficam as credenciais que o sistema precisa mas que
**nunca** podem entrar no repositório.

## O que mora aqui

| Arquivo | Para quê |
| --- | --- |
| `usuarios-iniciais.json` | Lista de nome / e-mail / perfil / senha inicial lida por `scripts/seed-usuarios.js` |

## usuarios-iniciais.json

Formato:

```json
[
  { "nome": "Fulano de Tal", "email": "fulano@setegce.com", "papel": "colaborador", "senha": "..." }
]
```

`papel` aceita `admin` ou `colaborador`.

O seed é **idempotente**: quem já existe não é sobrescrito (nem o nome, nem o
papel, nem a senha). Para trocar a senha de alguém depois do primeiro seed,
use a tela **Gestão de Acessos** (`/usuarios`) — é o caminho normal, não o
script.

```bash
npm run seed:usuarios
```

## Regras

- A senha só existe em texto puro **aqui** e na cabeça de quem a usa. No banco
  ela vira hash bcrypt (custo 10) e não há como voltar atrás.
- Nunca copie este arquivo para o repositório, para um anexo de e-mail ou para
  um chat. Para entregar uma senha a alguém, prefira a tela `/usuarios`, que
  gera e grava a nova senha direto no banco.
- Se um segredo daqui vazar, rotacione: troque a senha pela tela `/usuarios` e
  gere um novo `JWT_SECRET` (isso derruba todas as sessões abertas).
