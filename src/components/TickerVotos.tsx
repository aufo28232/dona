'use client'

import { useEffect, useState } from 'react'

type ItemFeed = { id: number; candidato: string; foto: string; criadoEm: string }

function haQuantoTempo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'agorinha'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`
  return `há ${Math.floor(s / 86400)}d`
}

/**
 * Feed "alguém acabou de votar em @fulano". A API só devolve o CANDIDATO
 * votado — quem votou permanece anônimo, nada de telefone ou nick do eleitor.
 */
export default function TickerVotos() {
  const [itens, setItens] = useState<ItemFeed[]>([])
  const [carregou, setCarregou] = useState(false)

  useEffect(() => {
    let vivo = true

    const puxar = async () => {
      try {
        const res = await fetch('/api/feed')
        if (!res.ok || !vivo) return
        const dados = await res.json()
        if (vivo) setItens(dados.itens ?? [])
      } catch {
        // feed é enfeite; falhar em silêncio está ok
      } finally {
        if (vivo) setCarregou(true)
      }
    }

    void puxar()
    const id = setInterval(puxar, 20_000)

    // Não gastar request com a aba em segundo plano.
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void puxar()
    }
    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      vivo = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [])

  if (!carregou) return null

  return (
    <section className="superficie rounded-2xl p-4 sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
        <span className="anim-ponto inline-block h-2 w-2 rounded-full bg-red-500" />
        Rolando agora
      </h3>

      {itens.length === 0 ? (
        <p className="text-sm text-white/40">
          Ninguém votou ainda. Vai ser você o primeiro? 👀
        </p>
      ) : (
        <ul className="space-y-2">
          {itens.map((item, i) => (
            <li
              key={item.id}
              className="anim-entrar flex items-center gap-2.5 text-sm"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.foto}
                alt=""
                width={26}
                height={26}
                loading="lazy"
                className="h-[26px] w-[26px] shrink-0 rounded-full object-cover ring-1 ring-white/15"
              />
              <span className="min-w-0 flex-1 truncate text-white/65">
                Alguém votou em{' '}
                <span className="font-bold text-twitch-light">@{item.candidato}</span>
              </span>
              <span className="shrink-0 text-[11px] text-white/30" suppressHydrationWarning>
                {haQuantoTempo(item.criadoEm)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
