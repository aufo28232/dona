import type { Metadata } from 'next'
import PlacarAoVivo from '@/components/PlacarAoVivo'
import TickerVotos from '@/components/TickerVotos'
import { RANKING_REVALIDATE_SECONDS } from '@/lib/constants'
import { getRanking, totalDeVotos, type LinhaRanking } from '@/lib/ranking'

/**
 * ISR de 30 min: a página é gerada uma vez e reaproveitada por 1800s. É de
 * propósito — o placar "congelado" entre atualizações é parte da brincadeira,
 * e de quebra o banco não toma um COUNT por visita.
 */
export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Placar — Melhor Membro da Live da Dona',
  description: 'Quem tá ganhando a eleição de melhor membro da live da Dona.',
}

export default async function PaginaRanking() {
  let ranking: LinhaRanking[] = []
  let erroBanco = false

  try {
    ranking = await getRanking()
  } catch (err) {
    console.error('Falha ao carregar ranking:', err)
    erroBanco = true
  }

  if (erroBanco) {
    return (
      <div className="superficie rounded-3xl p-10 text-center">
        <div className="text-5xl">🔌</div>
        <p className="mt-3 font-bold">Não consegui falar com o banco.</p>
        <p className="mt-1 text-sm text-white/50">
          O placar volta na próxima atualização, daqui a no máximo{' '}
          {RANKING_REVALIDATE_SECONDS / 60} minutos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PlacarAoVivo
        ranking={ranking}
        geradoEm={Date.now()}
        totalVotos={totalDeVotos(ranking)}
      />
      <TickerVotos />
    </div>
  )
}
