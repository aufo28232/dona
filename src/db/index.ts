import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type Db = ReturnType<typeof drizzle<typeof schema>>

// Em dev o hot-reload recria o módulo a cada mudança; sem esse cache global a
// gente vaza um pool de conexões por reload até o Postgres recusar conexão.
const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>
  __db?: Db
}

let dbInjetado: Db | null = null

/**
 * Injeta outra instância do Drizzle no lugar da conexão real. Existe só para
 * o smoke test rodar as MESMAS queries do site contra um Postgres em processo
 * (PGlite) — sem isso não haveria como validar o SQL sem um banco de verdade.
 * Nunca é chamado pelo código do site.
 */
export function __injetarDbParaTeste(instancia: Db | null) {
  dbInjetado = instancia
}

function criarDb(): Db {
  if (dbInjetado) return dbInjetado
  if (globalForDb.__db) return globalForDb.__db

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL não definida. Copie .env.example para .env e preencha.')
  }

  const client =
    globalForDb.__pgClient ??
    postgres(connectionString, {
      max: 5,
      // Pooler em modo transaction (Supabase :6543, PgBouncer) não suporta
      // prepared statements — desligar deixa o mesmo código rodar nos dois.
      prepare: false,
    })

  const instancia = drizzle(client, { schema })

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.__pgClient = client
    globalForDb.__db = instancia
  }

  return instancia
}

/**
 * Conexão preguiçosa via Proxy. Se isso conectasse na hora do import, um build
 * sem DATABASE_URL explodiria antes de qualquer try/catch das páginas rodar —
 * assim o erro só aparece na primeira query, onde dá para tratar.
 */
export const db = new Proxy({} as Db, {
  get(_alvo, prop, receptor) {
    const real = criarDb() as unknown as Record<string | symbol, unknown>
    const valor = Reflect.get(real, prop, receptor)
    return typeof valor === 'function' ? valor.bind(real) : valor
  },
})

export { schema }
