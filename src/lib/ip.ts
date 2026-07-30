import { createHash } from 'node:crypto'

/**
 * Pega o IP real do cliente. Na Vercel o request chega via proxy, então o IP
 * confiável é o PRIMEIRO item de x-forwarded-for (os seguintes podem ser
 * forjados pelo cliente).
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? '0.0.0.0'
}

/**
 * SHA-256 salgado. O IP puro nunca toca o banco — só este hash, que serve
 * exclusivamente para checar cooldown e rate limit.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT
  if (!salt) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('IP_HASH_SALT é obrigatória em produção.')
    }
    return createHash('sha256').update(`dev-salt:${ip}`).digest('hex')
  }
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

export function clientIpHash(headers: Headers): string {
  return hashIp(getClientIp(headers))
}
