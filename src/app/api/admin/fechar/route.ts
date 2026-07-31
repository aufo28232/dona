import { NextResponse } from 'next/server'
import { estaLogadoComoAdmin } from '@/lib/admin-auth'
import { fecharVotacao } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Fecha a urna manualmente, antes ou depois do prazo. Não mexe no vencedor. */
export async function POST() {
  if (!(await estaLogadoComoAdmin())) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }
  return NextResponse.json({ ok: true, estado: await fecharVotacao() })
}
