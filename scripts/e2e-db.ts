/**
 * Sobe um Postgres em processo (PGlite) escutando numa porta TCP, já com a
 * migration aplicada e os candidatos semeados. Serve para rodar o site de
 * verdade (`next dev`) contra um banco descartável, sem instalar Postgres.
 *
 *   npx tsx scripts/e2e-db.ts          # deixa rodando na porta 5433
 *
 * Em outro terminal:
 *   $env:DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/postgres"
 *   npm run dev
 */
import { createServer } from 'node:http'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { CANDIDATOS } from '../src/db/candidatos'

const PORTA = Number(process.env.E2E_DB_PORT ?? 5433)
/**
 * O socket do PGlite atende uma conexão por vez, e o `next dev` já ocupa ela.
 * Este HTTP minúsculo deixa o script de teste espiar o banco (a resposta do
 * captcha) sem disputar a conexão Postgres.
 */
const PORTA_ESPIA = Number(process.env.E2E_PEEK_PORT ?? 5434)

async function main() {
  const pg = new PGlite()
  await pg.waitReady

  const dirMigracoes = join(process.cwd(), 'drizzle')
  const arquivos = readdirSync(dirMigracoes)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const arquivo of arquivos) {
    const conteudo = readFileSync(join(dirMigracoes, arquivo), 'utf8')
    for (const bloco of conteudo.split('--> statement-breakpoint')) {
      const sqlLimpo = bloco.trim()
      if (sqlLimpo) await pg.exec(sqlLimpo)
    }
    console.log(`📦 migration aplicada: ${arquivo}`)
  }

  for (const c of CANDIDATOS) {
    await pg.query(
      `insert into streamers (nome, twitch_url, foto_url) values ($1, $2, $3)
       on conflict (nome) do update set twitch_url = excluded.twitch_url, foto_url = excluded.foto_url`,
      [c.nome, c.twitchUrl, c.fotoUrl],
    )
  }
  console.log(`🌱 ${CANDIDATOS.length} candidatos semeados`)

  const servidor = new PGLiteSocketServer({ db: pg, port: PORTA, host: '127.0.0.1' })
  await servidor.start()

  const espia = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORTA_ESPIA}`)
    if (url.pathname !== '/captcha') {
      res.writeHead(404).end()
      return
    }
    pg.query<{ resposta: string }>('select resposta from captchas where id = $1', [
      url.searchParams.get('id'),
    ])
      .then((r) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ resposta: r.rows[0]?.resposta ?? null }))
      })
      .catch((err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ erro: String(err) }))
      })
  })
  espia.listen(PORTA_ESPIA, '127.0.0.1')

  console.log(`\n🐘 Postgres de teste em postgresql://postgres:postgres@127.0.0.1:${PORTA}/postgres`)
  console.log(`🔎 Espia do captcha em http://127.0.0.1:${PORTA_ESPIA}/captcha?id=...`)
  console.log('   (Ctrl+C para parar. Os dados somem junto.)\n')

  const parar = async () => {
    espia.close()
    await servidor.stop()
    await pg.close()
    process.exit(0)
  }
  process.on('SIGINT', parar)
  process.on('SIGTERM', parar)
}

main().catch((err) => {
  console.error('💥 Falha ao subir o banco de teste:', err)
  process.exit(1)
})
