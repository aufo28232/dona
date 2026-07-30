import { NextResponse } from 'next/server'
import { db } from '@/db'
import { captchas } from '@/db/schema'
import { gerarDesafioCaptcha } from '@/lib/captcha-image'
import { CAPTCHA_TTL_MS } from '@/lib/constants'
import { clientIpHash } from '@/lib/ip'
import { excedeuCaptchas, limpezaOportunista } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST (e não GET) de propósito: nenhum proxy ou CDN vai cachear a resposta,
 * e cada chamada precisa ser uma emissão nova.
 *
 * A resposta devolve só o `id` — a imagem em si é buscada depois pelo client
 * via GET /api/captcha/[id]/imagem, como uma imagem de verdade (não embutida
 * em base64 aqui). A conta em texto e a resposta ficam no servidor.
 */
export async function POST(request: Request) {
  const ipHash = clientIpHash(request.headers)

  if (await excedeuCaptchas(ipHash)) {
    return NextResponse.json(
      { erro: 'Calma aí, muitos captchas em pouco tempo. Espera uns minutos.' },
      { status: 429 },
    )
  }

  const desafio = gerarDesafioCaptcha()
  const expiraEm = new Date(Date.now() + CAPTCHA_TTL_MS)

  const [linha] = await db
    .insert(captchas)
    .values({ resposta: desafio.resposta, imagemSvg: desafio.imagemSvg, ipHash, expiraEm })
    .returning({ id: captchas.id })

  void limpezaOportunista()

  return NextResponse.json(
    { id: linha.id, expiraEm: expiraEm.toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
