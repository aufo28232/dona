import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS } from '@/lib/constants'
import { assinarSessaoAdmin, senhaAdminConfere } from '@/lib/admin-auth'
import { clientIpHash } from '@/lib/ip'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Rate limit da tentativa de senha, em memória. Em serverless cada instância
 * tem seu próprio mapa (não é um limite global exato), mas isso já é
 * suficiente pra atrapalhar um brute-force ingênuo contra a senha de 8
 * dígitos — o mesmo espírito "defesa contra bot preguiçoso" do resto do
 * projeto, não uma garantia matemática.
 */
const tentativasPorIp = new Map<string, { count: number; desde: number }>()
const JANELA_MS = 10 * 60 * 1000
const LIMITE = 8

function excedeuTentativas(ipHash: string): boolean {
  const agora = Date.now()
  const registro = tentativasPorIp.get(ipHash)
  if (!registro || agora - registro.desde > JANELA_MS) {
    tentativasPorIp.set(ipHash, { count: 1, desde: agora })
    return false
  }
  registro.count++
  return registro.count > LIMITE
}

export async function POST(request: Request) {
  const ipHash = clientIpHash(request.headers)

  if (excedeuTentativas(ipHash)) {
    return NextResponse.json(
      { erro: 'Muitas tentativas. Espera uns minutos e tenta de novo.' },
      { status: 429 },
    )
  }

  let corpo: { senha?: unknown }
  try {
    corpo = (await request.json()) as { senha?: unknown }
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 })
  }

  const senha = typeof corpo.senha === 'string' ? corpo.senha : ''
  if (!senha || !senhaAdminConfere(senha)) {
    return NextResponse.json({ erro: 'Senha incorreta.' }, { status: 401 })
  }

  const jarra = await cookies()
  jarra.set(ADMIN_SESSION_COOKIE, assinarSessaoAdmin(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
