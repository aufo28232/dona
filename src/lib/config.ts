import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { captchas, configuracao, voteAttempts, votes } from '@/db/schema'
import { VOTACAO_DURACAO_MS } from './constants'

export type FaseVotacao = 'fechada' | 'aberta' | 'encerrada'

export type EstadoVotacao = {
  fase: FaseVotacao
  iniciadaEm: string | null
  terminaEm: string | null
  vencedorId: number | null
  anunciadoEm: string | null
}

/** Garante que a linha única (id=1) exista e devolve ela. */
async function linhaConfig() {
  const [existente] = await db.select().from(configuracao).where(eq(configuracao.id, 1)).limit(1)
  if (existente) return existente

  const [criada] = await db
    .insert(configuracao)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning()

  if (criada) return criada

  // Corrida rara: outra requisição criou entre o select e o insert.
  const [linha] = await db.select().from(configuracao).where(eq(configuracao.id, 1)).limit(1)
  return linha
}

export async function getEstadoVotacao(): Promise<EstadoVotacao> {
  const linha = await linhaConfig()
  return {
    fase: (linha.fase as FaseVotacao) ?? 'fechada',
    iniciadaEm: linha.iniciadaEm?.toISOString() ?? null,
    terminaEm: linha.terminaEm?.toISOString() ?? null,
    vencedorId: linha.vencedorId,
    anunciadoEm: linha.anunciadoEm?.toISOString() ?? null,
  }
}

/** A votação aceita voto agora? Considera a fase E o prazo de 48h. */
export async function votacaoEstaAberta(): Promise<boolean> {
  const linha = await linhaConfig()
  if (linha.fase !== 'aberta') return false
  if (linha.terminaEm && linha.terminaEm.getTime() <= Date.now()) return false
  return true
}

/** Abre (ou reabre) a votação: fase='aberta', reinicia o prazo de 48h a partir de agora. */
export async function abrirVotacao(): Promise<EstadoVotacao> {
  const agora = new Date()
  const termina = new Date(agora.getTime() + VOTACAO_DURACAO_MS)
  await db
    .insert(configuracao)
    .values({ id: 1, fase: 'aberta', iniciadaEm: agora, terminaEm: termina, atualizadoEm: agora })
    .onConflictDoUpdate({
      target: configuracao.id,
      set: { fase: 'aberta', iniciadaEm: agora, terminaEm: termina, atualizadoEm: agora },
    })
  return getEstadoVotacao()
}

/** Fecha a urna manualmente antes do prazo (ou depois, tanto faz). Não mexe no vencedor. */
export async function fecharVotacao(): Promise<EstadoVotacao> {
  const agora = new Date()
  await db
    .insert(configuracao)
    .values({ id: 1, fase: 'fechada', atualizadoEm: agora })
    .onConflictDoUpdate({ target: configuracao.id, set: { fase: 'fechada', atualizadoEm: agora } })
  return getEstadoVotacao()
}

/** Anuncia o vencedor: a home passa a mostrar só a tela de resultado. */
export async function anunciarVencedor(streamerId: number): Promise<EstadoVotacao> {
  const agora = new Date()
  await db
    .insert(configuracao)
    .values({
      id: 1,
      fase: 'encerrada',
      vencedorId: streamerId,
      anunciadoEm: agora,
      atualizadoEm: agora,
    })
    .onConflictDoUpdate({
      target: configuracao.id,
      set: { fase: 'encerrada', vencedorId: streamerId, anunciadoEm: agora, atualizadoEm: agora },
    })
  return getEstadoVotacao()
}

/** Desfaz o anúncio (volta pra fechada), sem apagar nenhum voto. */
export async function desfazerAnuncio(): Promise<EstadoVotacao> {
  const agora = new Date()
  await db
    .insert(configuracao)
    .values({ id: 1, fase: 'fechada', vencedorId: null, anunciadoEm: null, atualizadoEm: agora })
    .onConflictDoUpdate({
      target: configuracao.id,
      set: { fase: 'fechada', vencedorId: null, anunciadoEm: null, atualizadoEm: agora },
    })
  return getEstadoVotacao()
}

/**
 * Apaga TODOS os votos, tentativas e captchas, e zera a configuração pro
 * estado inicial (urna fechada, sem vencedor). Os candidatos (`streamers`)
 * não são tocados. Ação destrutiva — a rota que chama isso exige senha.
 */
export async function resetarDados(): Promise<EstadoVotacao> {
  await db.transaction(async (tx) => {
    await tx.delete(votes)
    await tx.delete(voteAttempts)
    await tx.delete(captchas)
    await tx
      .insert(configuracao)
      .values({ id: 1, fase: 'fechada', iniciadaEm: null, terminaEm: null, vencedorId: null, anunciadoEm: null })
      .onConflictDoUpdate({
        target: configuracao.id,
        set: {
          fase: 'fechada',
          iniciadaEm: null,
          terminaEm: null,
          vencedorId: null,
          anunciadoEm: null,
          atualizadoEm: sql`now()`,
        },
      })
  })
  return getEstadoVotacao()
}
