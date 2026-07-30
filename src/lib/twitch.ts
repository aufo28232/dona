const AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize'
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const USERS_URL = 'https://api.twitch.tv/helix/users'

function exigirEnv(nome: string): string {
  const v = process.env[nome]
  if (!v) throw new Error(`${nome} não configurada`)
  return v
}

/**
 * A Twitch exige que o redirect_uri bata exatamente com o registrado no
 * console de dev dela. `TWITCH_REDIRECT_URI` é o caminho previsível em
 * produção; sem ela, derivamos do host do próprio request — cobre local e
 * previews da Vercel, desde que cada domínio usado esteja cadastrado lá.
 */
export function redirectUriDoRequest(request: Request): string {
  if (process.env.TWITCH_REDIRECT_URI) return process.env.TWITCH_REDIRECT_URI

  const headers = request.headers
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  const protoForcado = headers.get('x-forwarded-proto')
  const proto = protoForcado ?? (host?.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}/api/auth/twitch/callback`
}

export function montarUrlAutorizacao(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: exigirEnv('TWITCH_CLIENT_ID'),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: '',
    state,
    // Sem isso, quem já autorizou uma vez nem vê a tela de novo — força
    // confirmar de novo a cada login, o que é o comportamento certo aqui.
    force_verify: 'true',
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

export async function trocarCodigoPorToken(code: string, redirectUri: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: exigirEnv('TWITCH_CLIENT_ID'),
    client_secret: exigirEnv('TWITCH_CLIENT_SECRET'),
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  if (!res.ok) throw new Error(`Troca de código por token falhou (${res.status})`)

  const dados = (await res.json()) as { access_token?: string }
  if (!dados.access_token) throw new Error('Twitch não devolveu access_token')
  return dados.access_token
}

export type UsuarioTwitch = {
  id: string
  login: string
  display_name: string
  profile_image_url: string
}

export async function buscarUsuarioTwitch(accessToken: string): Promise<UsuarioTwitch> {
  const res = await fetch(USERS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': exigirEnv('TWITCH_CLIENT_ID'),
    },
  })
  if (!res.ok) throw new Error(`Busca do usuário na Twitch falhou (${res.status})`)

  const dados = (await res.json()) as { data?: UsuarioTwitch[] }
  const usuario = dados.data?.[0]
  if (!usuario) throw new Error('Twitch não retornou nenhum usuário para esse token')
  return usuario
}
