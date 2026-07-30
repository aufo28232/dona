import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { captchas } from '@/db/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Serve o SVG do captcha como imagem de verdade (`Content-Type: image/svg+xml`),
 * não mais embutido como base64 dentro de um JSON — payload grande demais
 * dentro de uma resposta JSON se mostrou instável em trânsito na Vercel
 * (chegava cortado no meio em boa parte das vezes).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let linha
  try {
    ;[linha] = await db
      .select({ imagemSvg: captchas.imagemSvg, expiraEm: captchas.expiraEm })
      .from(captchas)
      .where(eq(captchas.id, id))
      .limit(1)
  } catch {
    // id fora do formato uuid
    return new NextResponse('Not found', { status: 404 })
  }

  if (!linha || linha.expiraEm.getTime() < Date.now()) {
    return new NextResponse('Not found', { status: 404 })
  }

  return new NextResponse(linha.imagemSvg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
