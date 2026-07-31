import { NextResponse } from 'next/server'
import { estaLogadoComoAdmin } from '@/lib/admin-auth'
import { desfazerAnuncio } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Desfaz o anúncio (volta pra tela de urna fechada), sem apagar nenhum voto. */
export async function POST() {
  if (!(await estaLogadoComoAdmin())) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }
  return NextResponse.json({ ok: true, estado: await desfazerAnuncio() })
}
