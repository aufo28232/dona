import { NextResponse } from 'next/server'
import { estaLogadoComoAdmin } from '@/lib/admin-auth'
import { resetarDados } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Apaga TODOS os votos/tentativas/captchas e zera a configuração. Irreversível
 * — por isso exige a frase de confirmação exata, além da sessão de admin.
 */
export async function POST(request: Request) {
  if (!(await estaLogadoComoAdmin())) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }

  let corpo: { confirmar?: unknown }
  try {
    corpo = (await request.json()) as { confirmar?: unknown }
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 })
  }

  if (corpo.confirmar !== 'RESETAR') {
    return NextResponse.json({ erro: 'Confirmação incorreta.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, estado: await resetarDados() })
}
