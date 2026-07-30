'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import BotaoCompartilhar from './BotaoCompartilhar'
import Confete from './Confete'
import Contagem from './Contagem'
import Podio from './Podio'
import { RANKING_REVALIDATE_SECONDS } from '@/lib/constants'
import type { LinhaRanking } from '@/lib/ranking'

export default function PlacarAoVivo({
  ranking,
  geradoEm,
  totalVotos,
}: {
  ranking: LinhaRanking[]
  geradoEm: number
  totalVotos: number
}) {
  const router = useRouter()
  const [confete, setConfete] = useState(0)
  const liderAnterior = useRef<number | null>(null)

  const proximaAtualizacao = geradoEm + RANKING_REVALIDATE_SECONDS * 1000

  // Confete quando a liderança troca de mãos.
  useEffect(() => {
    const liderAtual = ranking[0]?.id ?? null
    if (liderAnterior.current !== null && liderAtual !== liderAnterior.current) {
      setConfete((n) => n + 1)
    }
    liderAnterior.current = liderAtual
  }, [ranking])

  const top3 = ranking.slice(0, 3)
  const resto = ranking.slice(3)
  const maxVotos = Math.max(ranking[0]?.votos ?? 0, 1)

  return (
    <>
      <Confete gatilho={confete} />

      <section className="space-y-9">
        <header className="text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            O Placar <span className="inline-block">🏆</span>
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {totalVotos} voto{totalVotos === 1 ? '' : 's'} até agora
          </p>
          <p className="superficie mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-white/60">
            <span className="anim-ponto inline-block h-1.5 w-1.5 rounded-full bg-twitch-light" />
            Atualiza em{' '}
            <Contagem
              alvo={proximaAtualizacao}
              aoZerar={() => router.refresh()}
              className="font-mono font-bold tabular-nums text-twitch-light"
            />
          </p>
        </header>

        {totalVotos === 0 ? (
          <div className="superficie superficie-twitch rounded-3xl p-10 text-center">
            <div className="anim-flutuar text-5xl">🎪</div>
            <p className="font-display mt-3 text-xl font-semibold">Ainda ninguém votou</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-white/50">
              O placar tá mais vazio que live às 4 da manhã. Seja o primeiro a abrir a urna.
            </p>
            <a
              href="/"
              className="mt-5 inline-block rounded-full bg-gradient-to-r from-twitch to-twitch-deep px-6 py-3 text-sm font-bold shadow-lg shadow-twitch/30 transition hover:brightness-110"
            >
              Votar agora 🗳️
            </a>
          </div>
        ) : (
          <Podio top3={top3} />
        )}

        {resto.length > 0 && (
          <ol className="space-y-2">
            {resto.map((linha) => {
              const proporcao = Math.max((linha.votos / maxVotos) * 100, linha.votos > 0 ? 6 : 0)
              return (
                <li key={linha.id}>
                  <a
                    href={linha.twitchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="superficie group relative flex items-center gap-3 overflow-hidden rounded-2xl p-3 transition hover:border-twitch/40"
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-twitch/20 to-transparent transition-all duration-700"
                      style={{ width: `${proporcao}%` }}
                      aria-hidden="true"
                    />
                    <span className="relative z-10 flex w-7 shrink-0 justify-center font-mono text-sm font-bold text-white/35">
                      {linha.posicao}º
                    </span>
                    <Image
                      src={linha.fotoUrl}
                      alt=""
                      width={44}
                      height={44}
                      className="relative z-10 h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white/10"
                    />
                    <span className="relative z-10 min-w-0 flex-1 truncate font-bold">{linha.nome}</span>
                    <span className="relative z-10 shrink-0 text-sm">
                      <span className="font-black text-twitch-light">{linha.votos}</span>
                      <span className="ml-1 text-xs text-white/40">
                        voto{linha.votos === 1 ? '' : 's'}
                      </span>
                    </span>
                  </a>
                </li>
              )
            })}
          </ol>
        )}

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <BotaoCompartilhar ranking={ranking} />
          <a
            href="/"
            className="w-full rounded-2xl bg-gradient-to-r from-twitch to-twitch-deep px-5 py-3.5 text-center text-sm font-bold shadow-lg shadow-twitch/30 transition hover:brightness-110 sm:w-auto"
          >
            🗳️ Quero votar
          </a>
        </div>

        <p className="text-center text-[11px] text-white/30">
          O placar congela por 30 minutos entre atualizações. Faz parte do suspense.
        </p>
      </section>
    </>
  )
}
