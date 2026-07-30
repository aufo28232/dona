import { asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { streamers, votes } from '@/db/schema'

export type LinhaRanking = {
  id: number
  nome: string
  twitchUrl: string
  fotoUrl: string
  votos: number
  /** Posição 1-based, com empate compartilhando a mesma posição. */
  posicao: number
}

/**
 * Ranking derivado de COUNT sobre `votes` — nunca de contador materializado,
 * que sairia do ar com o real ao primeiro erro de escrita.
 *
 * Só devolve campos públicos. Telefone e ip_hash não entram aqui de jeito
 * nenhum, porque esse retorno vai direto para a página e para a API pública.
 */
export async function getRanking(): Promise<LinhaRanking[]> {
  const linhas = await db
    .select({
      id: streamers.id,
      nome: streamers.nome,
      twitchUrl: streamers.twitchUrl,
      fotoUrl: streamers.fotoUrl,
      votos: sql<number>`count(${votes.id})::int`,
    })
    .from(streamers)
    .leftJoin(votes, eq(votes.streamerId, streamers.id))
    .groupBy(streamers.id)
    .orderBy(desc(sql`count(${votes.id})`), asc(streamers.nome))

  let posicao = 0
  let ultimoTotal: number | null = null

  return linhas.map((linha, indice) => {
    if (linha.votos !== ultimoTotal) {
      posicao = indice + 1
      ultimoTotal = linha.votos
    }
    return { ...linha, posicao }
  })
}

export function totalDeVotos(ranking: LinhaRanking[]): number {
  return ranking.reduce((soma, l) => soma + l.votos, 0)
}
