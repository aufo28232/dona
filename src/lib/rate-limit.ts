import { and, count, desc, eq, gt, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { captchas, voteAttempts, votes } from '@/db/schema'
import { ATTEMPT_LIMIT, ATTEMPT_WINDOW_MS, CAPTCHA_LIMIT, CAPTCHA_WINDOW_MS, COOLDOWN_MS } from './constants'

/** Quantas tentativas de voto (válidas ou não) esse IP fez na janela. */
export async function excedeuTentativas(ipHash: string): Promise<boolean> {
  const desde = new Date(Date.now() - ATTEMPT_WINDOW_MS)
  const [row] = await db
    .select({ total: count() })
    .from(voteAttempts)
    .where(and(eq(voteAttempts.ipHash, ipHash), gt(voteAttempts.criadoEm, desde)))
  return (row?.total ?? 0) >= ATTEMPT_LIMIT
}

export async function excedeuCaptchas(ipHash: string): Promise<boolean> {
  const desde = new Date(Date.now() - CAPTCHA_WINDOW_MS)
  const [row] = await db
    .select({ total: count() })
    .from(captchas)
    .where(and(eq(captchas.ipHash, ipHash), gt(captchas.criadoEm, desde)))
  return (row?.total ?? 0) >= CAPTCHA_LIMIT
}

export async function registrarTentativa(ipHash: string, sucesso: boolean, motivo?: string) {
  await db.insert(voteAttempts).values({ ipHash, sucesso, motivo: motivo ?? null })
}

/**
 * Retorna quantos ms faltam até poder votar de novo, ou 0 se já pode.
 *
 * Checa por IP e, se a pessoa estiver logada, também pela conta da Twitch —
 * o que bloqueia tanto quem troca de IP quanto quem tenta uma segunda conta
 * na mesma conexão. Pega o voto mais recente entre as duas chaves.
 */
export async function msRestantesDoCooldown(
  ipHash: string,
  twitchUserId?: string | null,
): Promise<number> {
  const condicao = twitchUserId
    ? or(eq(votes.ipHash, ipHash), eq(votes.twitchUserId, twitchUserId))
    : eq(votes.ipHash, ipHash)

  const [ultimo] = await db
    .select({ criadoEm: votes.criadoEm })
    .from(votes)
    .where(condicao)
    .orderBy(desc(votes.criadoEm))
    .limit(1)

  if (!ultimo) return 0
  const restante = ultimo.criadoEm.getTime() + COOLDOWN_MS - Date.now()
  return restante > 0 ? restante : 0
}

/**
 * Limpeza oportunista de lixo (captchas vencidos, tentativas velhas). Roda de
 * vez em quando junto de um request normal para não precisar de cron.
 */
export async function limpezaOportunista() {
  if (Math.random() > 0.05) return
  try {
    await db.delete(captchas).where(sql`${captchas.expiraEm} < now() - interval '1 hour'`)
    await db.delete(voteAttempts).where(sql`${voteAttempts.criadoEm} < now() - interval '1 day'`)
  } catch (err) {
    console.error('limpeza oportunista falhou (ignorado):', err)
  }
}
