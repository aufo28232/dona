import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/constants'
import { clientIpHash } from '@/lib/ip'
import { msRestantesDoCooldown } from '@/lib/rate-limit'
import { verificarSessao } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Diz se este IP (e, se logado, esta conta da Twitch) já pode votar. Só para
 * a UI mostrar a contagem regressiva antes de preencher o formulário todo à
 * toa — a decisão de verdade é sempre refeita em /api/vote.
 */
export async function GET(request: Request) {
  const ipHash = clientIpHash(request.headers)
  const jarra = await cookies()
  const sessao = verificarSessao(jarra.get(SESSION_COOKIE)?.value)

  const msRestantes = await msRestantesDoCooldown(ipHash, sessao?.twitchUserId)

  return NextResponse.json(
    {
      podeVotar: msRestantes === 0,
      msRestantes,
      podeVotarEm: msRestantes > 0 ? new Date(Date.now() + msRestantes).toISOString() : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
