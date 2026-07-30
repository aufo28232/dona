import { timingSafeEqual } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { streamers, votes } from '@/db/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Única porta para os dados brutos (telefone, ip_hash). É do dono do projeto.
 *
 * Sem ADMIN_TOKEN configurado a rota simplesmente não existe (404) — assim
 * um deploy esquecido não vira um dump de telefones aberto na internet.
 *
 * Uso: curl -H "Authorization: Bearer $ADMIN_TOKEN" .../api/admin/export
 */
export async function GET(request: Request) {
  const esperado = process.env.ADMIN_TOKEN
  if (!esperado) return new NextResponse('Not found', { status: 404 })

  const header = request.headers.get('authorization') ?? ''
  const recebido = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (!tokenConfere(recebido, esperado)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
    })
  }

  const linhas = await db
    .select({
      id: votes.id,
      candidato: streamers.nome,
      telefone: votes.telefone,
      twitchUserId: votes.twitchUserId,
      twitchUsername: votes.twitchUsername,
      ipHash: votes.ipHash,
      userAgent: votes.userAgent,
      criadoEm: votes.criadoEm,
    })
    .from(votes)
    .innerJoin(streamers, eq(streamers.id, votes.streamerId))
    .orderBy(desc(votes.criadoEm))

  const cabecalho = 'id,candidato,telefone,twitch_user_id,twitch_username,ip_hash,user_agent,criado_em'
  const corpo = linhas
    .map((l) =>
      [
        l.id,
        l.candidato,
        l.telefone,
        l.twitchUserId,
        l.twitchUsername,
        l.ipHash,
        l.userAgent ?? '',
        l.criadoEm.toISOString(),
      ]
        .map(csvCampo)
        .join(','),
    )
    .join('\n')

  return new NextResponse(`${cabecalho}\n${corpo}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="votos.csv"',
      'Cache-Control': 'no-store',
      // Nunca indexar nem guardar em cache compartilhado.
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

/** Comparação de tempo constante, sem vazar o tamanho do token. */
function tokenConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido, 'utf8')
  const b = Buffer.from(esperado, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Escapa por RFC 4180 e ainda neutraliza injeção de fórmula: um telefone
 * começando com "=" ou "+" viraria fórmula executável ao abrir no Excel.
 */
function csvCampo(valor: string | number): string {
  const s = String(valor)
  const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${seguro.replace(/"/g, '""')}"`
}
