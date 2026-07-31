# 🏆 Melhor Membro da Live do judas50k

Site de votação da comunidade para eleger o melhor membro da live do judas50k.
13 candidatos, login obrigatório com a Twitch, 1 voto a cada 2 horas por IP
*e* por conta, captcha caseiro em texto e placar que atualiza a cada 30 minutos.
A votação (abrir/fechar, prazo de 48h, resetar dados e anunciar o vencedor) é
controlada ao vivo em `/admin`, protegido por senha.

> Nome do projeto ainda provisório (`melhor-membro`).

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Drizzle ORM** + Postgres (Vercel Postgres, Supabase, Neon, Railway — qualquer um)
- **Tailwind CSS 4**
- Login via **Twitch OAuth** (grátis, só precisa registrar um app)
- Fora isso, zero serviço pago: sem hCaptcha, sem reCAPTCHA, sem Twilio

## Registrando o app na Twitch

1. Entre em [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) → **Register Your Application**
2. Categoria: **Website Integration**
3. Em **OAuth Redirect URLs**, adicione (pode ter várias):
   - `http://localhost:3000/api/auth/twitch/callback` (dev)
   - `https://SEU-SITE/api/auth/twitch/callback` (produção)
4. Copie o **Client ID** e gere um **Client Secret**
5. Cole os dois em `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` no `.env`

## Rodando local

```bash
npm install
cp .env.example .env          # preencha DATABASE_URL, IP_HASH_SALT, SESSION_SECRET
                               # e TWITCH_CLIENT_ID/SECRET (ver seção acima)
npm run db:push               # cria as tabelas
npm run db:seed               # popula os 13 candidatos
npm run dev
```

### Sem Postgres instalado?

Tem um Postgres em processo (PGlite) pronto para testes. Num terminal:

```bash
npm run test:db     # sobe na porta 5433, já migrado e semeado
```

Noutro:

```bash
# PowerShell
$env:DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/postgres"
$env:IP_HASH_SALT="salt-de-teste"
$env:ADMIN_TOKEN="token-de-teste"
npm run dev
```

Os dados somem quando você para o processo.

## Testes

```bash
npm run test:smoke   # SQL de verdade contra PGlite: seed, captcha, cooldown (IP e conta), ranking
npm run test:e2e     # HTTP contra o site rodando: login, anti-bot, cooldown, privacidade
npm run typecheck
```

O `test:e2e` precisa do `test:db` e do `npm run dev` rodando (ver acima). Ele **não** precisa
de `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET` reais — simula uma sessão já logada assinando o
cookie com a mesma chave que o servidor usa (dev cai num segredo fixo quando `SESSION_SECRET`
não está definida), então o handshake de verdade com a Twitch não entra no teste.

Para conferir umas amostras do captcha no terminal:

```bash
npm run captcha:preview
```

## Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` | sim | Conexão Postgres |
| `IP_HASH_SALT` | sim em produção | Sal do SHA-256 dos IPs. **Trocar invalida todos os cooldowns.** |
| `TWITCH_CLIENT_ID` | sim | App registrado no console da Twitch |
| `TWITCH_CLIENT_SECRET` | sim | Idem — nunca expõe ao client |
| `TWITCH_REDIRECT_URI` | não | Só se o host do request divergir do domínio final |
| `SESSION_SECRET` | sim em produção | Assina o cookie de login. **Trocar desloga todo mundo.** |
| `ADMIN_TOKEN` | não | Libera `/api/admin/export`. Vazia = rota responde 404. |
| `ADMIN_PASSWORD` | sim em produção | Senha do painel `/admin`. Dev cai no fallback `45892832`. |
| `NEXT_PUBLIC_SITE_URL` | não | URL usada no botão de compartilhar |

Gere o sal e o segredo de sessão com o mesmo comando (rode duas vezes, um valor pra cada):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Deploy na Vercel

1. Suba o repo e importe na Vercel
2. Crie o banco (Vercel Postgres ou Supabase) e cole a `DATABASE_URL`
3. Configure `IP_HASH_SALT`, `SESSION_SECRET`, `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET`
   (ver "Registrando o app na Twitch" acima — não esqueça de cadastrar lá o
   Redirect URL de produção) e, se quiser o export, `ADMIN_TOKEN`
4. Deploy
5. Rode as migrations e o seed apontando para o banco de produção:

```bash
npm run db:push
npm run db:seed
```

Se usar **Supabase**, prefira a connection string do *Transaction Pooler*
(porta 6543) — o cliente já roda com `prepare: false`, que é o que o pooler
exige.

## Como funciona a votação

Para o voto contar, tudo isto precisa passar **no servidor**:

0. A urna precisa estar **aberta** (controlado em `/admin` — fora do prazo de
   48h ou antes do admin abrir, `/api/captcha` e `/api/vote` respondem 409)
1. Candidato selecionado existe no banco
2. Telefone com formato BR válido (DDD + número; não é verificado por SMS)
3. Sessão de login com a Twitch válida (cookie assinado, não expirado)
4. Captcha correto, não expirado, não usado antes e emitido para o mesmo IP
5. Pelo menos 2 segundos entre a emissão do captcha e o envio
6. Campos honeypot vazios
7. Nenhum voto desse IP **nem dessa conta da Twitch** nas últimas 2 horas
8. Menos de 12 tentativas desse IP nos últimos 10 minutos

Nada disso depende de validação no client — o front só repete as regras para
dar feedback bonito.

### Login com a Twitch

OAuth padrão (`authorization_code`), sem escopo nenhum além do básico — só
pra confirmar identidade, o site não posta nem lê nada da conta de quem vota.

- `GET /api/auth/twitch` manda pra tela de autorização da Twitch, guardando um
  `state` aleatório num cookie curto (10 min) pra proteção contra CSRF
- `GET /api/auth/twitch/callback` troca o código por token, busca `id` +
  `login` do usuário na Helix API e assina um cookie de sessão (HMAC-SHA256,
  `httpOnly`, 6h) com essa identidade
- `/api/vote` exige esse cookie: sem sessão válida, nem chega no captcha

Isso é a camada mais forte do sistema. Bater na API sem passar pela Twitch de
verdade não gera sessão nenhuma — um bot precisaria de uma conta real e
completar o consentimento de fato, não só imitar requisições HTTP.

O `id` numérico da conta (não o `@`, que dá pra trocar) vira a segunda chave
de cooldown: bloqueia tanto quem tenta várias contas na mesma conexão quanto
quem troca de rede pra votar de novo com a mesma conta.

### O captcha

Continha simples (`+`, `-`, `×`) gerada no servidor e mostrada em **texto puro**
pro usuário resolver (ex: `"7 + 3"` → digita `10`). Já existiu uma versão que
desenhava a conta como SVG pra dificultar leitura automática, mas dava
problema de renderização em produção — o valor real de defesa contra bot
preguiçoso vem das outras camadas, então trocamos pela versão simples e
confiável.

A resposta certa fica só no banco. O token expira em 5 minutos e é de uso
único (consumido com `UPDATE ... WHERE usado_em IS NULL RETURNING`, então duas
requisições simultâneas com o mesmo token não passam as duas).

Isolado, isso não seguraria um atacante dedicado — mas aliado ao login
obrigatório da Twitch, o custo de atacar sobe bastante: precisa de contas de
verdade *e* resolver o captcha de cada uma.

### O painel `/admin`

Protegido por senha (`ADMIN_PASSWORD`, cookie assinado HMAC separado do login
da Twitch). De lá dá para:

- **Abrir/reiniciar a votação** — define `fase = 'aberta'` e um prazo de 48h
  a partir de agora (mostrado ao vivo na home como contagem regressiva)
- **Fechar a votação** manualmente, antes ou depois do prazo
- **Anunciar o vencedor** — a home some com tudo (formulário, placar) e passa
  a mostrar só o nome/foto do vencedor + a música `public/winner.mp3` tocando de fundo
- **Resetar os dados** — apaga votos/tentativas/captchas e volta pro estado
  inicial (urna fechada, sem vencedor). Exige digitar `RESETAR` pra confirmar,
  além da sessão de admin. Os candidatos (`streamers`) não são apagados.

Coloque a música de comemoração em `public/winner.mp3` — se o arquivo não
existir, a tela do vencedor mostra só o nome/foto, sem quebrar.

### O placar

ISR de 30 minutos (`revalidate = 1800`). O placar fica congelado entre as
atualizações de propósito — faz parte da brincadeira, e de quebra o banco não
toma um `COUNT` por visita. A contagem é **sempre** derivada da tabela `votes`,
nunca de um contador materializado que poderia sair do ar com o real.

## Privacidade

- O IP **nunca** é gravado em texto puro — só o SHA-256 salgado, usado apenas
  para cooldown e rate limit
- Telefone e `ip_hash` não aparecem em nenhuma página nem em nenhuma resposta
  de API pública
- O feed "alguém votou em @fulano" só devolve o **candidato** votado; quem
  votou permanece anônimo
- Os dados brutos saem só por `/api/admin/export`, com `Authorization: Bearer
  $ADMIN_TOKEN` e comparação de tempo constante:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://SEU-SITE/api/admin/export
```

Sem `ADMIN_TOKEN` configurado a rota responde 404, para um deploy esquecido
não virar um dump de telefones aberto.

## Estrutura

```
src/
  app/
    page.tsx                 votação (ou tela de vencedor, ou urna fechada)
    ranking/page.tsx         placar (ISR 30 min)
    admin/page.tsx           painel do admin (senha + controle da votação)
    api/
      auth/twitch/           login OAuth (redirect + callback)
      auth/me/                identidade da sessão atual (pública, sem dados sensíveis)
      auth/logout/            derruba o cookie de sessão
      captcha/               emite o desafio (POST)
      vote/                  registra o voto — todas as camadas de validação
      cooldown/              quanto falta pra este IP/conta votar de novo
      feed/                  últimos votos, anonimizados
      ranking/               placar em JSON
      admin/export/          CSV bruto, protegido por token
      admin/login|logout/    sessão do painel /admin
      admin/painel/          estado + candidatos + placar (protegido)
      admin/abrir|fechar/    controla a fase da votação
      admin/anunciar|desanunciar/  define/desfaz o vencedor
      admin/resetar/         apaga tudo e zera a configuração
  components/                UI (formulário, pódio, confete, ticker, tela de vencedor…)
  db/                        schema Drizzle, seed, candidatos
  lib/                       captcha, config (fase da votação), ip, sessão, admin-auth,
                              twitch (oauth), validação, rate limit, ranking
scripts/                     testes e utilitários de conferência
drizzle/                     migrations SQL geradas
public/                      estáticos — coloque winner.mp3 aqui
```

## Mexendo nos candidatos

Edite `src/db/candidatos.ts` e rode `npm run db:seed`. O seed é idempotente:
atualiza foto e link de quem já existe e não duplica ninguém.
