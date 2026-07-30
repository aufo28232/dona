import { asc } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { streamers } from '@/db/schema'
import FormularioVoto, { type CandidatoPublico } from '@/components/FormularioVoto'
import TickerVotos from '@/components/TickerVotos'

// A lista de candidatos quase não muda; 5 min de cache economiza banco sem
// atrasar de forma perceptível uma correção de foto.
export const revalidate = 300

export default async function PaginaVotacao() {
  let candidatos: CandidatoPublico[] = []
  let erroBanco = false

  try {
    candidatos = await db
      .select({
        id: streamers.id,
        nome: streamers.nome,
        twitchUrl: streamers.twitchUrl,
        fotoUrl: streamers.fotoUrl,
      })
      .from(streamers)
      .orderBy(asc(streamers.nome))
  } catch (err) {
    // Build sem DATABASE_URL não pode derrubar o deploy inteiro.
    console.error('Falha ao carregar candidatos:', err)
    erroBanco = true
  }

  return (
    <div className="space-y-10">
      <section className="text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-twitch/30 bg-twitch/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-twitch-light">
          <span>🎪</span> Eleição oficial não oficial
        </p>
        <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Melhor Membro
          <span className="relative mt-1 block bg-gradient-to-r from-twitch-light via-pink-soft to-twitch-light bg-clip-text text-transparent">
            da Live da Dona
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/55 sm:text-base">
          Escolhe teu favorito, prova que não é robô e vota. Um voto a cada 2 horas — depois disso
          a urna te bloqueia. 💜
        </p>
      </section>

      {erroBanco || candidatos.length === 0 ? (
        <div className="superficie rounded-3xl p-8 text-center">
          <div className="text-5xl">🔌</div>
          <p className="mt-3 font-bold">
            {erroBanco ? 'Banco fora do ar.' : 'Nenhum candidato cadastrado ainda.'}
          </p>
          <p className="mt-1 text-sm text-white/50">
            {erroBanco
              ? 'Confere a DATABASE_URL e volta aqui.'
              : 'Roda `npm run db:seed` para popular os 13 candidatos.'}
          </p>
        </div>
      ) : (
        <FormularioVoto candidatos={candidatos} />
      )}

      <TickerVotos />

      <p className="text-center text-sm text-white/45">
        Já votou?{' '}
        <Link href="/ranking" className="font-bold text-twitch-light underline underline-offset-4">
          Vê como tá o placar →
        </Link>
      </p>
    </div>
  )
}
