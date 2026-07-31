'use client'

import { useRouter } from 'next/navigation'
import Contagem from './Contagem'

/** Badge com a contagem regressiva do prazo de 48h da votação (definido em /admin). */
export default function TimerVotacao({ terminaEm }: { terminaEm: string }) {
  const router = useRouter()

  return (
    <p className="superficie superficie-twitch mx-auto mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-white/70">
      <span className="anim-ponto inline-block h-1.5 w-1.5 rounded-full bg-twitch-light" />
      Votação encerra em{' '}
      <Contagem
        alvo={new Date(terminaEm).getTime()}
        aoZerar={() => router.refresh()}
        className="font-mono font-bold tabular-nums text-twitch-light"
      />
    </p>
  )
}
