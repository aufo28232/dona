/**
 * Exercita o site rodando de verdade, via HTTP. Confere as camadas anti-bot
 * (incluindo o login obrigatório com a Twitch), o cooldown e o vazamento de
 * dados sensíveis nas rotas públicas.
 *
 * Pré-requisito: `npx tsx scripts/e2e-db.ts` num terminal e `npm run dev`
 * noutro, com DATABASE_URL apontando pro banco de teste. Não precisa de
 * TWITCH_CLIENT_ID/SECRET reais — o login em si é simulado assinando a
 * sessão com a mesma chave que o servidor usa (ver `sessaoCookie` abaixo).
 *
 *   npx tsx scripts/e2e-http.ts
 */
import { SESSION_COOKIE } from '../src/lib/constants'
import { assinarSessao } from '../src/lib/session'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3000'
const ESPIA = process.env.E2E_PEEK ?? 'http://127.0.0.1:5434'
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? 'token-de-teste'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '45892832'

let falhas = 0
let passes = 0

function checar(nome: string, ok: boolean, detalhe = '') {
  if (ok) {
    passes++
    console.log(`  ✅ ${nome}`)
  } else {
    falhas++
    console.log(`  ❌ ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  }
}

/**
 * Assina uma sessão da Twitch localmente, do mesmo jeito que o callback do
 * OAuth faria depois do handshake de verdade. Sem `SESSION_SECRET` definida,
 * tanto este script quanto o `next dev` caem no mesmo segredo de dev fixo
 * (ver `src/lib/session.ts`), então as assinaturas batem sem configurar nada.
 * Trapaça deliberada: simula "logou com a Twitch" sem passar pela Twitch de
 * verdade, pra testar o resto do fluxo sem depender de credenciais reais.
 */
function sessaoCookie(twitchUserId: string, twitchLogin: string): string {
  const token = assinarSessao({
    twitchUserId,
    twitchLogin,
    displayName: twitchLogin,
    avatarUrl: 'https://static-cdn.jtvnw.net/user-default-pictures-uv/dummy.png',
  })
  return `${SESSION_COOKIE}=${token}`
}

/**
 * Cada "pessoa" do teste tem seu próprio x-forwarded-for (como a rota
 * identifica o IP) e, opcionalmente, um cookie de sessão da Twitch.
 */
function comIp(ip: string, init: RequestInit = {}, cookie?: string): RequestInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-forwarded-for': ip,
    ...(init.headers as Record<string, string> | undefined),
  }
  if (cookie) headers['cookie'] = cookie
  return { ...init, headers }
}

async function pegarCaptcha(ip: string) {
  const res = await fetch(`${BASE}/api/captcha`, comIp(ip, { method: 'POST' }))
  return (await res.json()) as { id: string; enunciado: string; expiraEm: string }
}

/**
 * Resolve o captcha perguntando a resposta ao script do banco de teste. É
 * trapaça de propósito: pelo caminho normal só um humano lendo a imagem
 * chegaria nela, e o que interessa aqui é exercitar o resto do fluxo.
 */
async function respostaDoCaptcha(id: string): Promise<string> {
  const res = await fetch(`${ESPIA}/captcha?id=${encodeURIComponent(id)}`)
  const { resposta } = (await res.json()) as { resposta: string | null }
  if (!resposta) throw new Error(`captcha ${id} não encontrado no banco de teste`)
  return resposta
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function votar(ip: string, corpo: Record<string, unknown>, cookie?: string) {
  const res = await fetch(
    `${BASE}/api/vote`,
    comIp(ip, { method: 'POST', body: JSON.stringify(corpo) }, cookie),
  )
  return { status: res.status, corpo: await res.json().catch(() => ({})) }
}

/** Loga no /admin e devolve o cookie de sessão (só o par nome=valor), ou null se falhar. */
async function loginAdmin(): Promise<string | null> {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha: ADMIN_PASSWORD }),
  })
  if (!res.ok) return null
  const setCookie = res.headers.get('set-cookie')
  return setCookie ? setCookie.split(';')[0] : null
}

/** Fluxo feliz completo: logado, captcha novo, espera o tempo mínimo, resposta certa. */
async function votoValido(
  ip: string,
  streamerId: number,
  twitchUserId: string,
  twitchLogin: string,
  extras: Record<string, unknown> = {},
) {
  const captcha = await pegarCaptcha(ip)
  const resposta = await respostaDoCaptcha(captcha.id)
  await esperar(2200) // passa do MIN_FILL_MS de 2s
  return votar(
    ip,
    {
      streamerId,
      telefone: '(11) 91234-5678',
      captchaId: captcha.id,
      captchaResposta: resposta,
      ...extras,
    },
    sessaoCookie(twitchUserId, twitchLogin),
  )
}

async function main() {
  // ---- Urna fechada (estado inicial, antes do admin abrir) ---------------
  console.log('\nPORTÃO DA VOTAÇÃO (urna ainda fechada)')
  const captchaComUrnaFechada = await fetch(`${BASE}/api/captcha`, comIp('10.0.0.10', { method: 'POST' }))
  checar('captcha não é emitido com a urna fechada', captchaComUrnaFechada.status === 409)

  const votoComUrnaFechada = await votar(
    '10.0.0.11',
    { streamerId: 1, telefone: '11912345678', captchaId: 'x', captchaResposta: '0' },
    sessaoCookie('tw-urna-fechada', 'urna_fechada'),
  )
  checar(
    'voto é rejeitado com a urna fechada',
    votoComUrnaFechada.status === 409 && votoComUrnaFechada.corpo.codigo === 'VOTACAO_FECHADA',
    `status ${votoComUrnaFechada.status}`,
  )

  // ---- Admin: login e abertura da votação ---------------------------------
  console.log('\nADMIN — LOGIN E ABERTURA')
  const loginErrado = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha: 'senha-bem-errada' }),
  })
  checar('login de admin com senha errada é negado', loginErrado.status === 401)

  const cookieAdmin = await loginAdmin()
  checar('login de admin com senha certa funciona', cookieAdmin !== null)

  const painelSemSessao = await fetch(`${BASE}/api/admin/painel`)
  checar('painel sem sessão de admin é negado', painelSemSessao.status === 401)

  const abrirSemSessao = await fetch(`${BASE}/api/admin/abrir`, { method: 'POST' })
  checar('abrir votação sem sessão de admin é negado', abrirSemSessao.status === 401)

  const abriu = await fetch(`${BASE}/api/admin/abrir`, {
    method: 'POST',
    headers: { cookie: cookieAdmin ?? '' },
  })
  const abriuCorpo = await abriu.json()
  checar('admin abre a votação', abriu.status === 200 && abriuCorpo.estado?.fase === 'aberta')
  checar('abrir define prazo de 48h', typeof abriuCorpo.estado?.terminaEm === 'string')

  // ---- Rotas públicas ----------------------------------------------------
  console.log('\nROTAS PÚBLICAS')
  const ranking0 = await (await fetch(`${BASE}/api/ranking`)).json()
  checar('GET /api/ranking responde', Array.isArray(ranking0.ranking))
  checar('ranking traz os 13 candidatos', ranking0.ranking?.length === 13, `veio ${ranking0.ranking?.length}`)
  checar(
    'ranking não vaza telefone nem ip',
    !JSON.stringify(ranking0).match(/telefone|ipHash|ip_hash/i),
  )

  const streamerId = ranking0.ranking[0].id

  const feed0 = await (await fetch(`${BASE}/api/feed`)).json()
  checar('GET /api/feed responde', Array.isArray(feed0.itens))

  const homeHtml = await (await fetch(`${BASE}/`)).text()
  checar('página de votação renderiza os candidatos', homeHtml.includes('laiobass'))
  checar('rodapé explica a coleta do telefone', homeHtml.includes('organização da votação'))

  const rankingHtml = await (await fetch(`${BASE}/ranking`)).text()
  checar('página de ranking renderiza', rankingHtml.includes('O Placar'))

  const meDeslogado = await (await fetch(`${BASE}/api/auth/me`)).json()
  checar('sem cookie, /api/auth/me diz deslogado', meDeslogado.logado === false)

  const meLogado = await (
    await fetch(`${BASE}/api/auth/me`, { headers: { cookie: sessaoCookie('tw-me', 'quem_sou_eu') } })
  ).json()
  checar('com cookie válido, /api/auth/me identifica a conta', meLogado.logado === true && meLogado.login === 'quem_sou_eu')

  // ---- Captcha em texto ---------------------------------------------------
  // Regressão específica: a versão anterior desenhava a continha como SVG, e
  // isso quebrava em produção. Agora o enunciado vem em texto puro no corpo
  // de /api/captcha, sem rota de imagem nenhuma.
  console.log('\nCAPTCHA EM TEXTO')
  const captchaTexto = await pegarCaptcha('10.0.0.200')
  checar(
    'POST /api/captcha devolve o enunciado em texto',
    typeof captchaTexto.enunciado === 'string' && captchaTexto.enunciado.length > 0,
    `veio ${JSON.stringify(captchaTexto)}`,
  )
  checar('não existe mais rota de imagem do captcha', (await fetch(`${BASE}/api/captcha/${captchaTexto.id}/imagem`)).status === 404)

  // ---- Login obrigatório --------------------------------------------------
  console.log('\nLOGIN COM A TWITCH')

  const semSessao = await votar('10.0.0.60', {
    streamerId,
    telefone: '11912345678',
    captchaId: 'irrelevante',
    captchaResposta: '0',
  })
  checar('voto sem sessão da Twitch é rejeitado', semSessao.status === 401 && semSessao.corpo.codigo === 'LOGIN')

  const sessaoQuebrada = await votar(
    '10.0.0.61',
    { streamerId, telefone: '11912345678', captchaId: 'irrelevante', captchaResposta: '0' },
    `${SESSION_COOKIE}=isso-nao-e-um-token-valido`,
  )
  checar('cookie de sessão corrompido é rejeitado', sessaoQuebrada.status === 401)

  // ---- Anti-bot ----------------------------------------------------------
  console.log('\nANTI-BOT')

  // Honeypot: resposta 200 fingindo sucesso, mas nada é gravado.
  const antesHoneypot = (await (await fetch(`${BASE}/api/feed`)).json()).itens.length
  const hp = await votoValido('10.0.0.99', streamerId, 'tw-bot-honeypot', 'bot_honeypot', {
    email: 'bot@spam.com',
  })
  const depoisHoneypot = (await (await fetch(`${BASE}/api/feed`)).json()).itens.length
  checar('honeypot responde 200 (não denuncia o bloqueio)', hp.status === 200)
  checar('honeypot NÃO grava o voto', depoisHoneypot === antesHoneypot, `${antesHoneypot} → ${depoisHoneypot}`)

  // Rápido demais: envia sem esperar os 2s.
  const cap = await pegarCaptcha('10.0.0.98')
  const resp = await respostaDoCaptcha(cap.id)
  const rapido = await votar(
    '10.0.0.98',
    { streamerId, telefone: '11912345678', captchaId: cap.id, captchaResposta: resp },
    sessaoCookie('tw-apressadinho', 'apressadinho'),
  )
  checar('envio em menos de 2s é rejeitado', rapido.status === 400, `status ${rapido.status}`)

  // Captcha errado.
  const cap2 = await pegarCaptcha('10.0.0.97')
  await esperar(2200)
  const errado = await votar(
    '10.0.0.97',
    { streamerId, telefone: '11912345678', captchaId: cap2.id, captchaResposta: '999' },
    sessaoCookie('tw-chutador', 'chutador'),
  )
  checar('captcha errado é rejeitado', errado.status === 400 && errado.corpo.codigo === 'CAPTCHA')

  // Reuso de captcha já consumido.
  const cap3 = await pegarCaptcha('10.0.0.96')
  const resp3 = await respostaDoCaptcha(cap3.id)
  await esperar(2200)
  await votar(
    '10.0.0.96',
    { streamerId, telefone: '11912345678', captchaId: cap3.id, captchaResposta: resp3 },
    sessaoCookie('tw-reciclador', 'reciclador'),
  )
  const reuso = await votar(
    '10.0.0.95',
    { streamerId, telefone: '11912345678', captchaId: cap3.id, captchaResposta: resp3 },
    sessaoCookie('tw-reciclador-2', 'reciclador_2'),
  )
  checar('captcha já usado não vale de novo', reuso.status === 400, `status ${reuso.status}`)

  // Captcha emitido para outro IP.
  const cap4 = await pegarCaptcha('10.0.0.94')
  const resp4 = await respostaDoCaptcha(cap4.id)
  await esperar(2200)
  const outroIp = await votar(
    '10.0.0.93',
    { streamerId, telefone: '11912345678', captchaId: cap4.id, captchaResposta: resp4 },
    sessaoCookie('tw-compartilhador', 'compartilhador'),
  )
  checar('captcha de outro IP é rejeitado', outroIp.status === 400, `status ${outroIp.status}`)

  // Sem captcha nenhum.
  const semCaptcha = await votar(
    '10.0.0.92',
    { streamerId, telefone: '11912345678' },
    sessaoCookie('tw-atalho', 'atalho'),
  )
  checar('voto sem captcha é rejeitado', semCaptcha.status === 400)

  // ---- Validação server-side --------------------------------------------
  console.log('\nVALIDAÇÃO NO SERVIDOR')
  const idFalso = await votoValido('10.0.0.91', 999999, 'tw-id-falso', 'candidato_falso')
  checar('candidato inexistente é rejeitado', idFalso.status === 400, `status ${idFalso.status}`)

  const telRuim = await votoValido('10.0.0.90', streamerId, 'tw-tel-ruim', 'telefone_ruim', {
    telefone: '123',
  })
  checar('telefone inválido é rejeitado no servidor', telRuim.status === 400)

  // ---- Fluxo feliz + cooldown por IP -------------------------------------
  console.log('\nVOTO E COOLDOWN POR IP')
  const ipVotante = '10.0.0.50'

  const cooldownAntes = await (await fetch(`${BASE}/api/cooldown`, comIp(ipVotante))).json()
  checar('antes de votar, pode votar', cooldownAntes.podeVotar === true)

  const voto = await votoValido(ipVotante, streamerId, 'tw-votante-1', 'votante_um')
  checar('voto válido é aceito', voto.status === 200 && voto.corpo.ok === true, JSON.stringify(voto.corpo))
  checar('resposta diz em quem votou', typeof voto.corpo.votadoEm === 'string')

  const segundo = await votoValido(ipVotante, streamerId, 'tw-votante-2', 'votante_dois')
  checar('segundo voto do mesmo IP (conta diferente) é bloqueado', segundo.status === 429, `status ${segundo.status}`)
  checar('bloqueio vem com código COOLDOWN', segundo.corpo.codigo === 'COOLDOWN')
  checar(
    'bloqueio informa quanto falta (~2h)',
    segundo.corpo.msRestantes > 7_000_000 && segundo.corpo.msRestantes <= 7_200_000,
    `${segundo.corpo.msRestantes}ms`,
  )

  const cooldownDepois = await (
    await fetch(`${BASE}/api/cooldown`, comIp(ipVotante, {}, sessaoCookie('tw-votante-1', 'votante_um')))
  ).json()
  checar('rota de cooldown reflete o bloqueio', cooldownDepois.podeVotar === false)

  const outroVotante = await votoValido('10.0.0.51', streamerId, 'tw-votante-3', 'votante_tres')
  checar('outro IP + outra conta continua podendo votar', outroVotante.status === 200)

  // ---- Cooldown por conta (cruza IP) -------------------------------------
  console.log('\nCOOLDOWN POR CONTA DA TWITCH (cruza IP)')

  const contaFantasma = { id: 'tw-fantasma', login: 'conta_fantasma' }
  const primeiroDaConta = await votoValido('10.0.1.10', streamerId, contaFantasma.id, contaFantasma.login)
  checar('primeiro voto da conta passa', primeiroDaConta.status === 200)

  const mesmaContaOutroIp = await votoValido('10.0.1.20', streamerId, contaFantasma.id, contaFantasma.login)
  checar(
    'mesma conta em outro IP é bloqueada pelo cooldown',
    mesmaContaOutroIp.status === 429 && mesmaContaOutroIp.corpo.codigo === 'COOLDOWN',
    `status ${mesmaContaOutroIp.status}`,
  )

  const ipEContaNovos = await votoValido('10.0.1.30', streamerId, 'tw-conta-nova', 'conta_nova')
  checar('IP novo + conta nova consegue votar', ipEContaNovos.status === 200)

  // ---- Feed e export não vazam nada --------------------------------------
  console.log('\nPRIVACIDADE')
  const feed = await (await fetch(`${BASE}/api/feed`)).json()
  checar('feed mostra os votos', feed.itens.length > 0)
  checar('feed não traz telefone', !JSON.stringify(feed).includes('91234'))
  checar('feed não traz quem votou', !JSON.stringify(feed).includes('votante_um'))
  checar('feed não traz ip_hash', !JSON.stringify(feed).match(/ipHash|ip_hash/i))

  const exportSemToken = await fetch(`${BASE}/api/admin/export`)
  checar('export sem token é negado', exportSemToken.status === 401, `status ${exportSemToken.status}`)

  const exportTokenErrado = await fetch(`${BASE}/api/admin/export`, {
    headers: { authorization: 'Bearer token-errado' },
  })
  checar('export com token errado é negado', exportTokenErrado.status === 401)

  const exportOk = await fetch(`${BASE}/api/admin/export`, {
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  })
  const csv = await exportOk.text()
  checar('export com token certo funciona', exportOk.status === 200)
  checar(
    'export traz telefone, twitch_user_id e ip_hash',
    csv.includes('ip_hash') && csv.includes('tw-votante-1') && csv.includes('11912345678'),
  )

  // ---- Rate limit de tentativas -----------------------------------------
  console.log('\nRATE LIMIT')
  const ipBruto = '10.0.0.77'
  let bloqueou = false
  for (let i = 0; i < 15; i++) {
    const r = await votar(
      ipBruto,
      { streamerId, telefone: '11912345678', captchaId: '00000000-0000-0000-0000-000000000000', captchaResposta: String(i) },
      sessaoCookie('tw-brutador', 'brutador'),
    )
    if (r.status === 429) {
      bloqueou = true
      break
    }
  }
  checar('brute-force no captcha leva 429', bloqueou)

  // ---- Admin: fechar, anunciar vencedor, resetar -------------------------
  console.log('\nADMIN — FECHAR / ANUNCIAR / RESETAR')
  const fechou = await fetch(`${BASE}/api/admin/fechar`, { method: 'POST', headers: { cookie: cookieAdmin ?? '' } })
  checar('admin fecha a votação', fechou.status === 200)

  const captchaDepoisDeFechar = await fetch(`${BASE}/api/captcha`, comIp('10.0.2.1', { method: 'POST' }))
  checar('captcha não é emitido depois de fechar', captchaDepoisDeFechar.status === 409)

  const votoDepoisDeFechar = await votar(
    '10.0.2.1',
    { streamerId, telefone: '11912345678', captchaId: 'irrelevante', captchaResposta: '0' },
    sessaoCookie('tw-pos-fechamento', 'pos_fechamento'),
  )
  checar(
    'voto é rejeitado depois de fechar',
    votoDepoisDeFechar.status === 409 && votoDepoisDeFechar.corpo.codigo === 'VOTACAO_FECHADA',
    `status ${votoDepoisDeFechar.status}`,
  )

  const anunciarInexistente = await fetch(`${BASE}/api/admin/anunciar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieAdmin ?? '' },
    body: JSON.stringify({ streamerId: 999999 }),
  })
  checar('anunciar candidato inexistente é rejeitado', anunciarInexistente.status === 400)

  const anunciou = await fetch(`${BASE}/api/admin/anunciar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieAdmin ?? '' },
    body: JSON.stringify({ streamerId }),
  })
  const anunciouCorpo = await anunciou.json()
  checar('admin anuncia o vencedor', anunciou.status === 200 && anunciouCorpo.estado?.fase === 'encerrada')

  const homeComVencedor = await (await fetch(`${BASE}/`)).text()
  checar('home mostra a tela de vencedor depois do anúncio', homeComVencedor.includes('Resultado final'))

  const desanunciou = await fetch(`${BASE}/api/admin/desanunciar`, { method: 'POST', headers: { cookie: cookieAdmin ?? '' } })
  checar('admin desfaz o anúncio', desanunciou.status === 200)

  const resetSemFraseCerta = await fetch(`${BASE}/api/admin/resetar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieAdmin ?? '' },
    body: JSON.stringify({ confirmar: 'errado' }),
  })
  checar('reset sem a frase de confirmação certa é rejeitado', resetSemFraseCerta.status === 400)

  const votosAntesDoReset = (await (await fetch(`${BASE}/api/ranking`)).json()).totalVotos
  checar('tem votos gravados antes do reset', votosAntesDoReset > 0, `veio ${votosAntesDoReset}`)

  const resetou = await fetch(`${BASE}/api/admin/resetar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieAdmin ?? '' },
    body: JSON.stringify({ confirmar: 'RESETAR' }),
  })
  checar('admin reseta os dados', resetou.status === 200)

  const votosDepoisDoReset = (await (await fetch(`${BASE}/api/ranking`)).json()).totalVotos
  checar('reset zera os votos', votosDepoisDoReset === 0, `veio ${votosDepoisDoReset}`)

  const urnaDepoisDoReset = await fetch(`${BASE}/api/captcha`, comIp('10.0.3.1', { method: 'POST' }))
  checar('reset deixa a urna fechada de novo', urnaDepoisDoReset.status === 409)

  console.log(`\n${'─'.repeat(50)}`)
  console.log(falhas === 0 ? `✅ ${passes} checagens passaram` : `❌ ${falhas} falha(s) de ${passes + falhas}`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('💥 E2E explodiu:', err)
  process.exit(1)
})
