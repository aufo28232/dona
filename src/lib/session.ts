import { createHmac, timingSafeEqual } from 'node:crypto'
import { SESSION_TTL_SECONDS } from './constants'

export type SessaoTwitch = {
  twitchUserId: string
  twitchLogin: string
  displayName: string
  avatarUrl: string
  iat: number
  exp: number
}

/**
 * Cookie assinado por HMAC — não é JWT nem depende de biblioteca externa,
 * mesmo esquema do hash de IP em `ip.ts`. Formato: `<payload-b64url>.<assinatura-b64url>`.
 */
function segredo(): string {
  const s = process.env.SESSION_SECRET
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET é obrigatória em produção.')
    }
    return 'dev-session-secret-inseguro'
  }
  return s
}

export function assinarSessao(dados: Omit<SessaoTwitch, 'iat' | 'exp'>): string {
  const agora = Date.now()
  const payload: SessaoTwitch = { ...dados, iat: agora, exp: agora + SESSION_TTL_SECONDS * 1000 }

  const corpo = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const assinatura = createHmac('sha256', segredo()).update(corpo).digest('base64url')
  return `${corpo}.${assinatura}`
}

/** Retorna a sessão se o token for válido, íntegro e não expirado; senão `null`. */
export function verificarSessao(token: string | undefined | null): SessaoTwitch | null {
  if (!token) return null

  const [corpo, assinatura] = token.split('.')
  if (!corpo || !assinatura) return null

  const esperada = createHmac('sha256', segredo()).update(corpo).digest('base64url')
  const a = Buffer.from(assinatura)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as SessaoTwitch
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    if (!payload.twitchUserId || !payload.twitchLogin) return null
    return payload
  } catch {
    return null
  }
}
