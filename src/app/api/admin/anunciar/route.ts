import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { streamers } from '@/db/schema'
import { estaLogadoComoAdmin } from '@/lib/admin-auth'
import { anunciarVencedor } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Anuncia o vencedor: a home passa a mostrar só a tela de resultado + winner.mp4. */
export async function POST(request: Request) {
  if (!(await estaLogadoComoAdmin())) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }

  let corpo: { streamerId?: unknown }
  try {
    corpo = (await request.json()) as { streamerId?: unknown }
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 })
  }

  const streamerId = Number(corpo.streamerId)
  if (!Number.isInteger(streamerId) || streamerId <= 0) {
    return NextResponse.json({ erro: 'Escolhe um candidato.' }, { status: 400 })
  }

  const [candidato] = await db.select({ id: streamers.id }).from(streamers).where(eq(streamers.id, streamerId)).limit(1)
  if (!candidato) {
    return NextResponse.json({ erro: 'Esse candidato não existe.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, estado: await anunciarVencedor(streamerId) })
}
