import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/constants'
import { verificarSessao } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Diz ao front se tem sessão da Twitch válida e qual identidade pública mostrar. */
export async function GET() {
  const jarra = await cookies()
  const sessao = verificarSessao(jarra.get(SESSION_COOKIE)?.value)

  if (!sessao) {
    return NextResponse.json({ logado: false }, { headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json(
    {
      logado: true,
      login: sessao.twitchLogin,
      nomeExibicao: sessao.displayName,
      avatarUrl: sessao.avatarUrl,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
