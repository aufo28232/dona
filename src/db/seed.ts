import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db } from './index'
import { streamers } from './schema'
import { CANDIDATOS } from './candidatos'

/**
 * Idempotente: roda quantas vezes quiser. Atualiza foto/link se mudarem e
 * nunca duplica candidato (conflito em `nome`). Não mexe em votos.
 */
async function main() {
  const result = await db
    .insert(streamers)
    .values(CANDIDATOS.map((c) => ({ ...c })))
    .onConflictDoUpdate({
      target: streamers.nome,
      set: {
        twitchUrl: sql`excluded.twitch_url`,
        fotoUrl: sql`excluded.foto_url`,
      },
    })
    .returning({ id: streamers.id, nome: streamers.nome })

  console.log(`✅ ${result.length} candidatos no banco:`)
  for (const r of result) console.log(`   #${r.id} ${r.nome}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Falha no seed:', err)
    process.exit(1)
  })
