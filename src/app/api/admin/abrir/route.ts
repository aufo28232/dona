import { NextResponse } from 'next/server'
import { estaLogadoComoAdmin } from '@/lib/admin-auth'
import { abrirVotacao } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Abre a urna e reinicia o prazo de 48h a partir de agora. */
export async function POST() {
  if (!(await estaLogadoComoAdmin())) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }
  return NextResponse.json({ ok: true, estado: await abrirVotacao() })
}
