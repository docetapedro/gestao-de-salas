# Gestão de Ocupação de Salas

App em **Next.js 15** (App Router) para cadastrar salas, marcar eventos por data/hora,
ver a **disponibilidade em tempo real numa grade**, gerir **usuários e permissões** e
enviar **email aos administradores quando um evento está prestes a começar**.

Stack: Next.js · TypeScript · Prisma · PostgreSQL (Neon) · Resend · Tailwind · Vercel Cron.
Tema em azul escuro (`navy`) e azul claro (`sky`/`brand`).

## Funcionalidades

- **Salas** — cadastro com nome, local, capacidade, cor e status (ativa/inativa).
- **Eventos** — título, sala, início/fim, descrição. Bloqueia conflito de horário na mesma sala.
- **Grade em tempo real** — salas nas linhas, horas nas colunas; ocupado em azul escuro,
  livre em azul claro; linha vermelha do "agora"; atualiza sozinha a cada 15s.
- **Usuários e permissões**:
  - `Administrador` — gere tudo, inclusive usuários; recebe os emails de aviso.
  - `Gestor` — gere salas e eventos.
  - `Visualizador` — só vê a grade.
- **Aviso por email** — o Vercel Cron chama `/api/cron/notify` a cada 5 min; eventos que
  começam dentro da janela (padrão 30 min) disparam email para os admins.

## Configuração local

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie um banco no [Neon](https://neon.tech) e uma conta no [Resend](https://resend.com).
3. Copie `.env.example` para `.env` e preencha `DATABASE_URL`, `AUTH_SECRET`,
   `RESEND_API_KEY`, `EMAIL_FROM` e `CRON_SECRET`.
4. Crie as tabelas e o usuário admin de exemplo:
   ```bash
   npm run db:push
   npm run db:seed
   ```
   Login inicial: **admin@salas.local** / **admin123** (troque depois).
5. Rode:
   ```bash
   npm run dev
   ```
   Acesse http://localhost:3000

## Deploy na Vercel

1. Suba o projeto para um repositório Git e importe na Vercel.
2. Em **Settings → Environment Variables**, adicione as mesmas variáveis do `.env`.
3. A Vercel detecta o `vercel.json` e agenda o cron `/api/cron/notify` (a cada 5 min).
   O header `Authorization: Bearer <CRON_SECRET>` é enviado automaticamente.
4. Rode `npm run db:push` apontando para o banco de produção (ou use `prisma migrate`).

### Testar o aviso de email manualmente

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" https://SEU-APP.vercel.app/api/cron/notify
```
