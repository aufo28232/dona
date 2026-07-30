import { NextResponse } from 'next/server'
import { RANKING_REVALIDATE_SECONDS } from '@/lib/constants'
import { getRanking, totalDeVotos } from '@/lib/ranking'

export const runtime = 'nodejs'
export const revalidate = 1800

/**
 * Ranking público. Mesma cadência de 30 min da página (`revalidate`), para o
 * placar não divergir dependendo de onde você olha.
 */
export async function GET() {
  let ranking
  try {
    ranking = await getRanking()
  } catch (err) {
    // Banco fora do ar não pode derrubar o build (prerender) nem virar 500
    // sem explicação para quem consome a API.
    console.error('Falha ao carregar ranking:', err)
    return NextResponse.json(
      { erro: 'Placar indisponível no momento.', ranking: [], totalVotos: 0 },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return NextResponse.json(
    {
      atualizadoEm: new Date().toISOString(),
      intervaloSegundos: RANKING_REVALIDATE_SECONDS,
      totalVotos: totalDeVotos(ranking),
      ranking,
    },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${RANKING_REVALIDATE_SECONDS}, stale-while-revalidate=60`,
      },
    },
  )
}
