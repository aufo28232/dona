'use client'

import { useState } from 'react'
import type { LinhaRanking } from '@/lib/ranking'

export default function BotaoCompartilhar({ ranking }: { ranking: LinhaRanking[] }) {
  const [copiou, setCopiou] = useState(false)

  const montarTexto = () => {
    const url =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '')

    const podio = ranking
      .slice(0, 3)
      .map((l, i) => `${['🥇', '🥈', '🥉'][i]} @${l.nome} — ${l.votos} voto${l.votos === 1 ? '' : 's'}`)
      .join('\n')

    return `🏆 Melhor Membro da Live da Dona — placar parcial:\n\n${podio}\n\nVota tu também: ${url}`
  }

  const compartilhar = async () => {
    const texto = montarTexto()

    // Web Share só existe em https/localhost e mobile; desktop cai no clipboard.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Melhor Membro da Live da Dona', text: texto })
        return
      } catch {
        // usuário cancelou ou o share falhou — segue pro clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(texto)
      setCopiou(true)
      setTimeout(() => setCopiou(false), 2500)
    } catch {
      window.prompt('Copia aí:', texto)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void compartilhar()}
      className="superficie w-full rounded-2xl px-5 py-3.5 text-sm font-bold transition hover:border-twitch/50 hover:bg-twitch/10 sm:w-auto"
    >
      {copiou ? '✅ Copiado! Cola no chat' : '📢 Compartilhar o placar'}
    </button>
  )
}
