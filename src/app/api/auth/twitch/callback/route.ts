import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OAUTH_STATE_COOKIE, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/constants'
import { assinarSessao } from '@/lib/session'
import { buscarUsuarioTwitch, redirectUriDoRequest, trocarCodigoPorToken } from '@/lib/twitch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const erroTwitch = url.searchParams.get('error')

  const cancelar = (motivo: 'cancelado' | 'falhou') => {
    const res = NextResponse.redirect(`${url.origin}/?login=${motivo}`)
    res.cookies.delete(OAUTH_STATE_COOKIE)
    return res
  }

  if (erroTwitch) return cancelar('cancelado')

  const jarra = await cookies()
  const stateEsperado = jarra.get(OAUTH_STATE_COOKIE)?.value

  // Compara o `state` que voltou com o que a gente guardou antes de mandar
  // pra Twitch — é o que impede um CSRF de logar a vítima na conta do atacante.
  if (!code || !state || !stateEsperado || state !== stateEsperado) return cancelar('falhou')

  try {
    const redirectUri = redirectUriDoRequest(request)
    const accessToken = await trocarCodigoPorToken(code, redirectUri)
    const usuario = await buscarUsuarioTwitch(accessToken)

    const token = assinarSessao({
      twitchUserId: usuario.id,
      twitchLogin: usuario.login,
      displayName: usuario.display_name,
      avatarUrl: usuario.profile_image_url,
    })

    const res = NextResponse.redirect(`${url.origin}/?login=ok`)
    res.cookies.delete(OAUTH_STATE_COOKIE)
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_SECONDS,
      path: '/',
    })
    return res
  } catch (err) {
    console.error('Falha no login com a Twitch:', err)
    return cancelar('falhou')
  }
}
