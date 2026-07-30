import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_SECONDS } from '@/lib/constants'
import { montarUrlAutorizacao, redirectUriDoRequest } from '@/lib/twitch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Início do login. Não é fetch — é pra navegador seguir via <a href>, já que
 * o passo seguinte é o navegador ir pra tela de autorização da Twitch.
 */
export async function GET(request: Request) {
  if (!process.env.TWITCH_CLIENT_ID) {
    return NextResponse.json(
      { erro: 'Login com a Twitch ainda não configurado neste ambiente.' },
      { status: 503 },
    )
  }

  const state = randomBytes(16).toString('hex')
  const redirectUri = redirectUriDoRequest(request)

  const res = NextResponse.redirect(montarUrlAutorizacao(state, redirectUri))
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: OAUTH_STATE_TTL_SECONDS,
    path: '/',
  })
  return res
}
