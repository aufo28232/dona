import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS } from './constants'

const SENHA_PADRAO_DEV = '45892832'

/** Senha do painel /admin. Fallback só em dev — produção exige a env var. */
function senhaEsperada(): string {
  const s = process.env.ADMIN_PASSWORD
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_PASSWORD é obrigatória em produção.')
    }
    return SENHA_PADRAO_DEV
  }
  return s
}

/** Comparação de tempo constante, sem vazar o tamanho da senha digitada. */
export function senhaAdminConfere(recebida: string): boolean {
  const esperada = senhaEsperada()
  const a = Buffer.from(recebida)
  const b = Buffer.from(esperada)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

type SessaoAdmin = { admin: true; iat: number; exp: number }

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

/**
 * Cookie assinado por HMAC, mesmo esquema do login da Twitch em `session.ts`
 * — reaproveita o mesmo `SESSION_SECRET`, mas é um cookie totalmente
 * separado (`ADMIN_SESSION_COOKIE`), então logar/deslogar de um não mexe no
 * outro.
 */
export function assinarSessaoAdmin(): string {
  const agora = Date.now()
  const payload: SessaoAdmin = { admin: true, iat: agora, exp: agora + ADMIN_SESSION_TTL_SECONDS * 1000 }
  const corpo = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const assinatura = createHmac('sha256', segredo()).update(corpo).digest('base64url')
  return `${corpo}.${assinatura}`
}

export function verificarSessaoAdmin(token: string | undefined | null): boolean {
  if (!token) return false

  const [corpo, assinatura] = token.split('.')
  if (!corpo || !assinatura) return false

  const esperada = createHmac('sha256', segredo()).update(corpo).digest('base64url')
  const a = Buffer.from(assinatura)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false

  try {
    const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as SessaoAdmin
    return payload.admin === true && typeof payload.exp === 'number' && payload.exp > Date.now()
  } catch {
    return false
  }
}

/** Lê o cookie de admin da requisição atual e diz se a sessão é válida. */
export async function estaLogadoComoAdmin(): Promise<boolean> {
  const jarra = await cookies()
  return verificarSessaoAdmin(jarra.get(ADMIN_SESSION_COOKIE)?.value)
}
