import { and, eq, isNull } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { captchas, streamers, votes } from '@/db/schema'
import { COOLDOWN_MS, MIN_FILL_MS, SESSION_COOKIE } from '@/lib/constants'
import { votacaoEstaAberta } from '@/lib/config'
import { clientIpHash } from '@/lib/ip'
import {
  excedeuTentativas,
  limpezaOportunista,
  msRestantesDoCooldown,
  registrarTentativa,
} from '@/lib/rate-limit'
import { verificarSessao } from '@/lib/session'
import { validarTelefone } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Corpo = {
  streamerId?: unknown
  telefone?: unknown
  captchaId?: unknown
  captchaResposta?: unknown
  // Honeypots — humano nunca preenche.
  email?: unknown
  website?: unknown
}

const texto = (v: unknown): string => (typeof v === 'string' ? v : '')

export async function POST(request: Request) {
  const ipHash = clientIpHash(request.headers)
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

  // ---- Portão: a urna precisa estar aberta -------------------------------
  // Checado antes de tudo, sem contar como "tentativa" — não é abuso, é só
  // um estado normal do site (antes de abrir, ou depois de encerrar).
  if (!(await votacaoEstaAberta())) {
    return NextResponse.json(
      { erro: 'A votação não está aberta no momento.', codigo: 'VOTACAO_FECHADA' },
      { status: 409 },
    )
  }

  // ---- Camada 1: rate limit de TENTATIVAS ------------------------------
  // Sem isso, o captcha de 1 dígito seria brutável em segundos.
  if (await excedeuTentativas(ipHash)) {
    return NextResponse.json(
      { erro: 'Muitas tentativas seguidas. Respira e tenta de novo daqui a pouco.' },
      { status: 429 },
    )
  }

  let corpo: Corpo
  try {
    corpo = (await request.json()) as Corpo
  } catch {
    await registrarTentativa(ipHash, false, 'json_invalido')
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 })
  }

  // ---- Camada 2: honeypot ----------------------------------------------
  // Descarta em silêncio: o bot recebe 200 e acha que funcionou, então não
  // fica variando a estratégia até achar uma que passe.
  if (texto(corpo.email).trim() !== '' || texto(corpo.website).trim() !== '') {
    await registrarTentativa(ipHash, false, 'honeypot')
    return NextResponse.json({ ok: true, descartado: true })
  }

  // ---- Camada 3: login com a Twitch -------------------------------------
  // Sem sessão válida não tem voto. É a camada mais forte: um bot precisaria
  // de uma conta de verdade e completar o OAuth de verdade, não só bater na API.
  const jarra = await cookies()
  const sessao = verificarSessao(jarra.get(SESSION_COOKIE)?.value)
  if (!sessao) {
    await registrarTentativa(ipHash, false, 'sem_sessao')
    return NextResponse.json(
      { erro: 'Faça login com a Twitch pra votar.', codigo: 'LOGIN' },
      { status: 401 },
    )
  }

  // ---- Camada 4: cooldown de 2h por IP + por conta da Twitch -----------
  // Antes do captcha: assim quem já votou não queima um desafio à toa e
  // recebe direto a contagem regressiva.
  const restante = await msRestantesDoCooldown(ipHash, sessao.twitchUserId)
  if (restante > 0) {
    await registrarTentativa(ipHash, false, 'cooldown')
    return NextResponse.json(
      {
        erro: 'Você (ou essa conexão) já votou faz pouco tempo.',
        codigo: 'COOLDOWN',
        msRestantes: restante,
        podeVotarEm: new Date(Date.now() + restante).toISOString(),
      },
      { status: 429 },
    )
  }

  // ---- Camada 5: captcha (consumo atômico + conferência) ---------------
  const captchaId = texto(corpo.captchaId)
  if (!captchaId) {
    await registrarTentativa(ipHash, false, 'captcha_ausente')
    return NextResponse.json({ erro: 'Resolve o captcha aí.', codigo: 'CAPTCHA' }, { status: 400 })
  }

  // UPDATE ... WHERE usado_em IS NULL RETURNING marca e devolve numa tacada só.
  // Duas requisições simultâneas com o mesmo token: só uma leva.
  let consumido
  try {
    const linhas = await db
      .update(captchas)
      .set({ usadoEm: new Date() })
      .where(and(eq(captchas.id, captchaId), isNull(captchas.usadoEm)))
      .returning({
        resposta: captchas.resposta,
        ipHash: captchas.ipHash,
        expiraEm: captchas.expiraEm,
        criadoEm: captchas.criadoEm,
      })
    consumido = linhas[0]
  } catch {
    // id fora do formato uuid
    await registrarTentativa(ipHash, false, 'captcha_id_invalido')
    return NextResponse.json(
      { erro: 'Captcha inválido, pega um novo.', codigo: 'CAPTCHA' },
      { status: 400 },
    )
  }

  if (!consumido) {
    await registrarTentativa(ipHash, false, 'captcha_usado_ou_inexistente')
    return NextResponse.json(
      { erro: 'Esse captcha já foi usado. Pega um novo.', codigo: 'CAPTCHA' },
      { status: 400 },
    )
  }

  if (consumido.expiraEm.getTime() < Date.now()) {
    await registrarTentativa(ipHash, false, 'captcha_expirado')
    return NextResponse.json(
      { erro: 'Captcha expirou. Gera outro e tenta de novo.', codigo: 'CAPTCHA' },
      { status: 400 },
    )
  }

  // O captcha foi emitido para outro IP — sinal de token compartilhado/revendido.
  if (consumido.ipHash !== ipHash) {
    await registrarTentativa(ipHash, false, 'captcha_ip_divergente')
    return NextResponse.json(
      { erro: 'Captcha inválido, pega um novo.', codigo: 'CAPTCHA' },
      { status: 400 },
    )
  }

  // ---- Camada 6: tempo mínimo de preenchimento -------------------------
  // Medido contra o INSTANTE DE EMISSÃO gravado no servidor, não contra um
  // timestamp mandado pelo client (que seria trivial de forjar).
  if (Date.now() - consumido.criadoEm.getTime() < MIN_FILL_MS) {
    await registrarTentativa(ipHash, false, 'rapido_demais')
    return NextResponse.json(
      { erro: 'Calma, foi rápido demais. Confere os dados e envia de novo.', codigo: 'CAPTCHA' },
      { status: 400 },
    )
  }

  if (texto(corpo.captchaResposta).trim() !== consumido.resposta) {
    await registrarTentativa(ipHash, false, 'captcha_errado')
    return NextResponse.json(
      { erro: 'Errou a conta do captcha. Tenta com um novo.', codigo: 'CAPTCHA' },
      { status: 400 },
    )
  }

  // ---- Camada 7: revalidação de TODO o resto ---------------------------
  const streamerId = Number(corpo.streamerId)
  if (!Number.isInteger(streamerId) || streamerId <= 0) {
    await registrarTentativa(ipHash, false, 'streamer_invalido')
    return NextResponse.json({ erro: 'Escolhe um candidato.', campo: 'streamer' }, { status: 400 })
  }

  const [candidato] = await db
    .select({ id: streamers.id, nome: streamers.nome, fotoUrl: streamers.fotoUrl })
    .from(streamers)
    .where(eq(streamers.id, streamerId))
    .limit(1)

  if (!candidato) {
    await registrarTentativa(ipHash, false, 'streamer_inexistente')
    return NextResponse.json({ erro: 'Esse candidato não existe.', campo: 'streamer' }, { status: 400 })
  }

  const telefone = validarTelefone(texto(corpo.telefone))
  if (!telefone.ok) {
    await registrarTentativa(ipHash, false, 'telefone_invalido')
    return NextResponse.json({ erro: telefone.erro, campo: 'telefone' }, { status: 400 })
  }

  // ---- Grava --------------------------------------------------------------
  // twitchUserId/twitchUsername vêm da sessão verificada no servidor, nunca
  // do corpo da requisição — o client não tem como forjar em quem está logado.
  await db.insert(votes).values({
    streamerId: candidato.id,
    telefone: telefone.valor,
    twitchUserId: sessao.twitchUserId,
    twitchUsername: sessao.twitchLogin,
    ipHash,
    userAgent,
  })

  await registrarTentativa(ipHash, true, 'ok')
  void limpezaOportunista()

  // Nada de revalidar /ranking aqui: o placar é ISR de 30 min de propósito,
  // faz parte da graça esperar a próxima atualização.
  return NextResponse.json({
    ok: true,
    votadoEm: candidato.nome,
    proximoVotoEm: new Date(Date.now() + COOLDOWN_MS).toISOString(),
  })
}
