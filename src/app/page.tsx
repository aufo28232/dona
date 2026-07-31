import { asc } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { streamers } from '@/db/schema'
import FormularioVoto, { type CandidatoPublico } from '@/components/FormularioVoto'
import TelaVencedor from '@/components/TelaVencedor'
import TickerVotos from '@/components/TickerVotos'
import TimerVotacao from '@/components/TimerVotacao'
import { getEstadoVotacao } from '@/lib/config'

// O estado da votação (aberta/fechada/vencedor) é controlado ao vivo em
// /admin, então essa página não pode ficar em cache por minutos — sempre
// busca fresco.
export const dynamic = 'force-dynamic'

export default async function PaginaVotacao() {
  let candidatos: CandidatoPublico[] = []
  let erroBanco = false
  let estado: Awaited<ReturnType<typeof getEstadoVotacao>> | null = null

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
    estado = await getEstadoVotacao()
  } catch (err) {
    // Build sem DATABASE_URL não pode derrubar o deploy inteiro.
    console.error('Falha ao carregar a página de votação:', err)
    erroBanco = true
  }

  if (erroBanco || !estado) {
    return (
      <div className="superficie rounded-3xl p-8 text-center">
        <div className="text-5xl">🔌</div>
        <p className="mt-3 font-bold">Banco fora do ar.</p>
        <p className="mt-1 text-sm text-white/50">Confere a DATABASE_URL e volta aqui.</p>
      </div>
    )
  }

  if (candidatos.length === 0) {
    return (
      <div className="superficie rounded-3xl p-8 text-center">
        <div className="text-5xl">🔌</div>
        <p className="mt-3 font-bold">Nenhum candidato cadastrado ainda.</p>
        <p className="mt-1 text-sm text-white/50">Roda `npm run db:seed` para popular os candidatos.</p>
      </div>
    )
  }

  // ---- Resultado anunciado: some tudo, fica só a tela do vencedor ---------
  if (estado.fase === 'encerrada' && estado.vencedorId) {
    const vencedor = candidatos.find((c) => c.id === estado.vencedorId)
    if (vencedor) {
      return <TelaVencedor nome={vencedor.nome} fotoUrl={vencedor.fotoUrl} twitchUrl={vencedor.twitchUrl} />
    }
  }

  // ---- Urna fechada (ainda não abriu, ou fechada manualmente) -------------
  if (estado.fase !== 'aberta') {
    return (
      <div className="space-y-10">
        <section className="text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-twitch/30 bg-twitch/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-twitch-light">
            <span>🎪</span> Eleição oficial não oficial
          </p>
          <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Melhor Membro
            <span className="relative mt-1 block bg-gradient-to-r from-twitch-light via-pink-soft to-twitch-light bg-clip-text text-transparent">
              da Live do judas50k
            </span>
          </h1>
        </section>

        <div className="superficie rounded-3xl p-8 text-center">
          <div className="text-5xl">🔒</div>
          <p className="mt-3 font-bold">A urna tá fechada no momento.</p>
          <p className="mt-1 text-sm text-white/50">Volta mais tarde — o admin ainda vai abrir a votação.</p>
        </div>

        <p className="text-center text-sm text-white/45">
          Quer ver o histórico?{' '}
          <Link href="/ranking" className="font-bold text-twitch-light underline underline-offset-4">
            Vê como tá o placar →
          </Link>
        </p>
      </div>
    )
  }

  // ---- Votação aberta -------------------------------------------------------
  return (
    <div className="space-y-10">
      <section className="text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-twitch/30 bg-twitch/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-twitch-light">
          <span>🎪</span> Eleição oficial não oficial
        </p>
        <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Melhor Membro
          <span className="relative mt-1 block bg-gradient-to-r from-twitch-light via-pink-soft to-twitch-light bg-clip-text text-transparent">
            da Live do judas50k
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/55 sm:text-base">
          Escolha o melhor (ou menos pior) participante da live do judas, prova que não é robô e
          vota. 1 voto a cada 2 horas.
        </p>
        {estado.terminaEm && <TimerVotacao terminaEm={estado.terminaEm} />}
      </section>

      <FormularioVoto candidatos={candidatos} />

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
