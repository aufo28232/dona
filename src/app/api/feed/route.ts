import { desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { streamers, votes } from '@/db/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Feed "alguém acabou de votar em @fulano".
 *
 * PRIVACIDADE: seleciona explicitamente só nome/foto do CANDIDATO e a hora.
 * Quem votou é anônimo — telefone, username de quem votou e ip_hash não são
 * nem lidos do banco aqui, então não há como vazarem por descuido.
 */
export async function GET() {
  const linhas = await db
    .select({
      id: votes.id,
      candidato: streamers.nome,
      foto: streamers.fotoUrl,
      criadoEm: votes.criadoEm,
    })
    .from(votes)
    .innerJoin(streamers, eq(streamers.id, votes.streamerId))
    .orderBy(desc(votes.criadoEm))
    .limit(12)

  return NextResponse.json(
    { itens: linhas.map((l) => ({ ...l, criadoEm: l.criadoEm.toISOString() })) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
