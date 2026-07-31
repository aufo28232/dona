import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/** Candidatos da eleição. */
export const streamers = pgTable(
  'streamers',
  {
    id: serial('id').primaryKey(),
    nome: text('nome').notNull(),
    twitchUrl: text('twitch_url').notNull(),
    fotoUrl: text('foto_url').notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('streamers_nome_uq').on(t.nome)],
)

/**
 * Votos. A contagem NUNCA é guardada aqui como coluna — o ranking é sempre
 * derivado de um COUNT sobre esta tabela.
 *
 * `twitchUserId` vem do login OAuth (o id numérico estável da conta, não o
 * @ que a pessoa pode trocar) — é a segunda chave de cooldown, além do IP.
 * `twitchUsername` guarda o login/@ no momento do voto, só para exibição.
 *
 * PRIVACIDADE: `telefone` e `ipHash` são dados restritos. Nenhuma rota pública
 * pode devolvê-los. O IP nunca é gravado em texto puro, só o SHA-256 salgado.
 */
export const votes = pgTable(
  'votes',
  {
    id: serial('id').primaryKey(),
    streamerId: integer('streamer_id')
      .notNull()
      .references(() => streamers.id, { onDelete: 'cascade' }),
    telefone: text('telefone').notNull(),
    twitchUserId: text('twitch_user_id').notNull(),
    twitchUsername: text('twitch_username').notNull(),
    ipHash: text('ip_hash').notNull(),
    userAgent: text('user_agent'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('votes_ip_hash_criado_em_idx').on(t.ipHash, t.criadoEm),
    index('votes_twitch_user_id_criado_em_idx').on(t.twitchUserId, t.criadoEm),
    index('votes_streamer_id_idx').on(t.streamerId),
    index('votes_criado_em_idx').on(t.criadoEm),
  ],
)

/**
 * Desafios de captcha emitidos. A resposta vive só no servidor e o token é
 * de uso único (`usadoEm`), então não dá para reaproveitar um captcha já
 * resolvido para despejar vários votos.
 */
export const captchas = pgTable(
  'captchas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resposta: text('resposta').notNull(),
    ipHash: text('ip_hash').notNull(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    usadoEm: timestamp('usado_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('captchas_ip_hash_criado_em_idx').on(t.ipHash, t.criadoEm),
    index('captchas_expira_em_idx').on(t.expiraEm),
  ],
)

/**
 * Toda tentativa de voto (válida ou não) vira uma linha aqui. Serve para o
 * rate limit de tentativas — sem isso dava para brutar o captcha à vontade.
 */
export const voteAttempts = pgTable(
  'vote_attempts',
  {
    id: serial('id').primaryKey(),
    ipHash: text('ip_hash').notNull(),
    sucesso: boolean('sucesso').notNull().default(false),
    motivo: text('motivo'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('vote_attempts_ip_hash_criado_em_idx').on(t.ipHash, t.criadoEm)],
)

/**
 * Configuração da votação — SEMPRE uma linha só (id fixo = 1), controlada
 * pelo painel /admin. `fase`:
 *   'fechada'   — urna fechada (estado inicial, ou depois de um "Fechar" manual)
 *   'aberta'    — recebendo votos, com prazo em `terminaEm`
 *   'encerrada' — vencedor anunciado; o site mostra só a tela de resultado
 *
 * Não referencia `streamers.id` com FK: o "resetar dados" apaga tudo em
 * `votes`/`captchas`/`vote_attempts` sem tocar em `streamers`, mas o vencedor
 * é uma decisão manual do admin que deve sobreviver a esse reset até uma nova
 * votação ser aberta de novo — uma FK com onDelete('set null') sobre um id
 * que nunca é apagado não muda nada na prática, então mantemos simples.
 */
export const configuracao = pgTable('configuracao', {
  id: integer('id').primaryKey().default(1),
  fase: text('fase').notNull().default('fechada'),
  iniciadaEm: timestamp('iniciada_em', { withTimezone: true }),
  terminaEm: timestamp('termina_em', { withTimezone: true }),
  vencedorId: integer('vencedor_id'),
  anunciadoEm: timestamp('anunciado_em', { withTimezone: true }),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
})

export type Streamer = typeof streamers.$inferSelect
export type Vote = typeof votes.$inferSelect
export type Configuracao = typeof configuracao.$inferSelect
