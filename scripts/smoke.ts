/**
 * Smoke test contra um Postgres real rodando em processo (PGlite). Roda o SQL
 * de verdade — upsert do seed, consumo atômico do captcha, ranking com COUNT,
 * cooldown, rate limit — sem precisar de banco externo.
 *
 *   npx tsx scripts/smoke.ts
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { and, eq, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'

import { __injetarDbParaTeste, db } from '../src/db'
import * as schema from '../src/db/schema'
import { captchas, streamers, voteAttempts, votes } from '../src/db/schema'
import { CANDIDATOS } from '../src/db/candidatos'
import { getRanking, totalDeVotos } from '../src/lib/ranking'
import { excedeuTentativas, msRestantesDoCooldown, registrarTentativa } from '../src/lib/rate-limit'
import { gerarDesafioCaptcha } from '../src/lib/captcha-image'
import { validarTelefone } from '../src/lib/validation'
import { ATTEMPT_LIMIT, COOLDOWN_MS } from '../src/lib/constants'

let falhas = 0
let passes = 0

function checar(nome: string, condicao: boolean, detalhe = '') {
  if (condicao) {
    passes++
    console.log(`  ✅ ${nome}`)
  } else {
    falhas++
    console.log(`  ❌ ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  }
}

async function main() {
  // ---- Sobe o banco e aplica a migration gerada pelo drizzle-kit ---------
  const pg = new PGlite()
  const testDb = drizzle(pg, { schema })
  __injetarDbParaTeste(testDb as never)

  const dirMigracoes = join(process.cwd(), 'drizzle')
  const arquivos = readdirSync(dirMigracoes)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const arquivo of arquivos) {
    const conteudo = readFileSync(join(dirMigracoes, arquivo), 'utf8')
    for (const bloco of conteudo.split('--> statement-breakpoint')) {
      const sqlLimpo = bloco.trim()
      if (sqlLimpo) await pg.exec(sqlLimpo)
    }
  }
  console.log(`\n📦 ${arquivos.length} migration(s) aplicada(s) no PGlite\n`)

  // ---- Seed --------------------------------------------------------------
  console.log('SEED')
  const { sql } = await import('drizzle-orm')
  const semear = () =>
    db
      .insert(streamers)
      .values(CANDIDATOS.map((c) => ({ ...c })))
      .onConflictDoUpdate({
        target: streamers.nome,
        set: { twitchUrl: sql`excluded.twitch_url`, fotoUrl: sql`excluded.foto_url` },
      })
      .returning({ id: streamers.id })

  const primeira = await semear()
  checar('seed insere os 13 candidatos', primeira.length === 13, `veio ${primeira.length}`)

  await semear()
  const totalDepois = await db.select().from(streamers)
  checar('seed é idempotente (não duplica)', totalDepois.length === 13, `veio ${totalDepois.length}`)

  // ---- Validações puras --------------------------------------------------
  console.log('\nVALIDAÇÃO')
  checar('celular 11 dígitos passa', validarTelefone('(11) 91234-5678').ok)
  checar('fixo 10 dígitos passa', validarTelefone('1132145678').ok)
  checar('com DDI 55 passa', validarTelefone('+55 11 91234-5678').ok)
  checar('curto demais reprova', !validarTelefone('11912').ok)
  checar('DDD inválido reprova', !validarTelefone('0912345678').ok)
  checar('celular sem o 9 reprova', !validarTelefone('11812345678').ok)

  // ---- Captcha: consumo atômico -----------------------------------------
  console.log('\nCAPTCHA')
  const ipA = 'hash-ip-A'
  const desafio = gerarDesafioCaptcha()
  const [emitido] = await db
    .insert(captchas)
    .values({
      resposta: desafio.resposta,
      ipHash: ipA,
      expiraEm: new Date(Date.now() + 5 * 60_000),
    })
    .returning({ id: captchas.id })

  const consumir = (id: string) =>
    db
      .update(captchas)
      .set({ usadoEm: new Date() })
      .where(and(eq(captchas.id, id), isNull(captchas.usadoEm)))
      .returning({ resposta: captchas.resposta, ipHash: captchas.ipHash })

  const primeiroUso = await consumir(emitido.id)
  checar('captcha é consumido na 1ª vez', primeiroUso.length === 1)
  checar('resposta guardada bate com o desafio', primeiroUso[0]?.resposta === desafio.resposta)

  const segundoUso = await consumir(emitido.id)
  checar('mesmo captcha NÃO é reutilizável', segundoUso.length === 0, `veio ${segundoUso.length}`)

  // ---- Cooldown ----------------------------------------------------------
  console.log('\nCOOLDOWN')
  const [candidato] = await db.select().from(streamers).limit(1)

  checar('IP sem voto pode votar', (await msRestantesDoCooldown(ipA)) === 0)

  await db.insert(votes).values({
    streamerId: candidato.id,
    telefone: '11912345678',
    twitchUserId: 'tw-fulano',
    twitchUsername: 'fulano_123',
    ipHash: ipA,
    userAgent: 'smoke-test',
  })

  const restante = await msRestantesDoCooldown(ipA)
  checar(
    'IP que acabou de votar fica bloqueado ~2h',
    restante > COOLDOWN_MS - 10_000 && restante <= COOLDOWN_MS,
    `restante=${restante}ms`,
  )
  checar('cooldown de um IP não afeta outro', (await msRestantesDoCooldown('hash-ip-B')) === 0)

  // Mesma conta da Twitch, IP diferente: continua bloqueada.
  checar(
    'cooldown também prende pela conta da Twitch (IP diferente)',
    (await msRestantesDoCooldown('hash-ip-outro', 'tw-fulano')) > 0,
  )
  checar(
    'conta diferente no mesmo IP ainda é barrada pelo IP',
    (await msRestantesDoCooldown(ipA, 'tw-outra-conta')) > 0,
  )
  checar(
    'IP novo + conta nova não é afetado',
    (await msRestantesDoCooldown('hash-ip-novo', 'tw-conta-nova')) === 0,
  )

  // Voto de 2h05 atrás não deve mais bloquear.
  await db.insert(votes).values({
    streamerId: candidato.id,
    telefone: '11912345679',
    twitchUserId: 'tw-ciclano',
    twitchUsername: 'ciclano_123',
    ipHash: 'hash-ip-C',
    userAgent: 'smoke-test',
    criadoEm: new Date(Date.now() - (COOLDOWN_MS + 5 * 60_000)),
  })
  checar(
    'voto antigo (>2h) libera de novo',
    (await msRestantesDoCooldown('hash-ip-C', 'tw-ciclano')) === 0,
  )

  // ---- Rate limit de tentativas -----------------------------------------
  console.log('\nRATE LIMIT')
  const ipD = 'hash-ip-D'
  checar('IP novo não está limitado', !(await excedeuTentativas(ipD)))
  for (let i = 0; i < ATTEMPT_LIMIT; i++) await registrarTentativa(ipD, false, 'teste')
  checar(`bloqueia após ${ATTEMPT_LIMIT} tentativas`, await excedeuTentativas(ipD))
  checar('limite é por IP, não global', !(await excedeuTentativas('hash-ip-E')))

  const tentativas = await db.select().from(voteAttempts)
  checar('tentativas ficam registradas', tentativas.length >= ATTEMPT_LIMIT)

  // ---- Ranking -----------------------------------------------------------
  console.log('\nRANKING')
  const todos = await db.select().from(streamers)
  const favorito = todos[3]
  const vice = todos[7]

  for (let i = 0; i < 5; i++) {
    await db.insert(votes).values({
      streamerId: favorito.id,
      telefone: '11900000000',
      twitchUserId: `tw-eleitor-${i}`,
      twitchUsername: `eleitor_${i}`,
      ipHash: `hash-massa-${i}`,
    })
  }
  for (let i = 0; i < 3; i++) {
    await db.insert(votes).values({
      streamerId: vice.id,
      telefone: '11900000000',
      twitchUserId: `tw-eleitor-v${i}`,
      twitchUsername: `eleitor_v${i}`,
      ipHash: `hash-massa-v${i}`,
    })
  }

  const ranking = await getRanking()
  checar('ranking traz todos os candidatos', ranking.length === 13, `veio ${ranking.length}`)
  checar('líder é quem tem mais votos', ranking[0]?.id === favorito.id)
  checar('líder com a contagem certa', ranking[0]?.votos === 5, `veio ${ranking[0]?.votos}`)
  checar('2º lugar correto', ranking[1]?.id === vice.id && ranking[1]?.votos === 3)
  checar('ordenado do maior pro menor', ranking.every((l, i) => i === 0 || l.votos <= ranking[i - 1].votos))
  checar('candidato sem voto aparece com 0', ranking.some((l) => l.votos === 0))
  checar('posições 1,2,3 no topo', ranking[0].posicao === 1 && ranking[1].posicao === 2)

  const zerados = ranking.filter((l) => l.votos === 0)
  checar(
    'empate compartilha a mesma posição',
    new Set(zerados.map((l) => l.posicao)).size === 1,
    `posições=${[...new Set(zerados.map((l) => l.posicao))].join(',')}`,
  )

  const total = totalDeVotos(ranking)
  const totalReal = (await db.select().from(votes)).length
  checar('total bate com a tabela de votos', total === totalReal, `${total} vs ${totalReal}`)

  // ---- Privacidade: o que o ranking devolve -----------------------------
  console.log('\nPRIVACIDADE')
  const campos = Object.keys(ranking[0])
  checar('ranking não expõe telefone', !campos.includes('telefone'), campos.join(','))
  checar('ranking não expõe ip_hash', !campos.some((c) => c.toLowerCase().includes('ip')))

  await pg.close()

  console.log(`\n${'─'.repeat(50)}`)
  console.log(falhas === 0 ? `✅ ${passes} checagens passaram` : `❌ ${falhas} falha(s) de ${passes + falhas}`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('💥 Smoke test explodiu:', err)
  process.exit(1)
})
