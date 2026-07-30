import Image from 'next/image'
import { TITULOS_LIDER } from '@/lib/constants'
import type { LinhaRanking } from '@/lib/ranking'

const ESTILOS = [
  {
    medalha: '🥇',
    altura: 'h-20 sm:h-28',
    anel: 'ring-ouro',
    texto: 'text-ouro',
    numeral: 'text-ouro/25',
    step: 'from-[#4a3a12] via-[#332711] to-ink-2 border-ouro/40',
    foto: 'h-20 w-20 sm:h-24 sm:w-24',
  },
  {
    medalha: '🥈',
    altura: 'h-14 sm:h-20',
    anel: 'ring-prata',
    texto: 'text-prata',
    numeral: 'text-prata/25',
    step: 'from-[#3a3f47] via-[#282c33] to-ink-2 border-prata/35',
    foto: 'h-16 w-16 sm:h-20 sm:w-20',
  },
  {
    medalha: '🥉',
    altura: 'h-10 sm:h-14',
    anel: 'ring-bronze',
    texto: 'text-bronze',
    numeral: 'text-bronze/25',
    step: 'from-[#4a2f19] via-[#332215] to-ink-2 border-bronze/35',
    foto: 'h-16 w-16 sm:h-20 sm:w-20',
  },
]

/** Ordem visual: prata à esquerda, ouro no meio (mais alto), bronze à direita. */
const ORDEM_VISUAL = ['order-2', 'order-1', 'order-3']

export default function Podio({ top3 }: { top3: LinhaRanking[] }) {
  if (top3.length === 0) return null

  // Título determinístico (derivado do id) para servidor e client baterem —
  // sortear aqui daria mismatch de hidratação.
  const titulo = TITULOS_LIDER[top3[0].id % TITULOS_LIDER.length]

  return (
    <div className="flex items-end justify-center gap-2.5 sm:gap-4">
      {top3.map((linha, i) => {
        const e = ESTILOS[i]
        return (
          <div
            key={linha.id}
            className={`anim-entrar flex w-full max-w-[10rem] flex-col items-center ${ORDEM_VISUAL[i]}`}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="flex h-7 items-center">
              {i === 0 && (
                <span className="anim-flutuar whitespace-nowrap rounded-full bg-ouro/15 px-2.5 py-1 text-[10px] font-bold text-ouro sm:text-[11px]">
                  {titulo}
                </span>
              )}
            </div>

            <a
              href={linha.twitchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative z-10 flex flex-col items-center gap-1 pb-2 transition hover:-translate-y-1"
            >
              <div className="relative">
                <Image
                  src={linha.fotoUrl}
                  alt={linha.nome}
                  width={96}
                  height={96}
                  className={`${e.foto} rounded-full object-cover ring-4 ${e.anel} shadow-xl`}
                />
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink-2 text-base ring-2 ring-ink shadow">
                  {e.medalha}
                </span>
              </div>
              <span className="font-display mt-1.5 w-full max-w-[9rem] truncate text-center text-sm font-semibold sm:text-base">
                {linha.nome}
              </span>
              <span className={`text-[11px] font-bold ${e.texto}`}>
                {linha.votos} voto{linha.votos === 1 ? '' : 's'}
              </span>
            </a>

            <div
              className={`relative w-full overflow-hidden rounded-t-2xl border-x border-t bg-gradient-to-b ${e.altura} ${e.step}`}
            >
              <span
                className={`font-display absolute inset-0 flex items-center justify-center text-4xl font-bold sm:text-5xl ${e.numeral}`}
                aria-hidden="true"
              >
                {i + 1}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
