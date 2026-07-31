import { asc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { streamers } from '@/db/schema'
import { estaLogadoComoAdmin } from '@/lib/admin-auth'
import { getEstadoVotacao } from '@/lib/config'
import { getRanking, totalDeVotos } from '@/lib/ranking'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Estado + candidatos + placar, tudo que o painel /admin precisa pra renderizar. */
export async function GET() {
  if (!(await estaLogadoComoAdmin())) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }

  const estado = await getEstadoVotacao()
  const candidatos = await db
    .select({ id: streamers.id, nome: streamers.nome, fotoUrl: streamers.fotoUrl })
    .from(streamers)
    .orderBy(asc(streamers.nome))
  const ranking = await getRanking()

  return NextResponse.json(
    { estado, candidatos, ranking, totalVotos: totalDeVotos(ranking) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
