import { randomInt } from 'node:crypto'

/**
 * Captcha caseiro. Duas decisões importantes aqui:
 *
 * 1. Os dígitos são desenhados como TRAÇOS VETORIAIS (estilo display de
 *    calculadora), não como <text>. Se fossem <text>, qualquer bot leria a
 *    resposta direto do markup do SVG sem precisar de OCR nenhum.
 * 2. Cada glifo tem rotação, escala e deslocamento próprios, e o fundo leva
 *    ruído por cima e por baixo — atrapalha segmentação automática.
 *
 * Não é hCaptcha. É um filtro contra bot preguiçoso, que é o que o projeto
 * precisa. A defesa de verdade contra alguém dedicado é o rate limit por IP.
 */

const W = 240
const H = 90

type Seg = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'

// Glifo desenhado numa caixa 10x20.
const SEG_COORDS: Record<Seg, [number, number, number, number]> = {
  a: [1, 0, 9, 0],
  b: [10, 1, 10, 9],
  c: [10, 11, 10, 19],
  d: [1, 20, 9, 20],
  e: [0, 11, 0, 19],
  f: [0, 1, 0, 9],
  g: [1, 10, 9, 10],
}

const DIGIT_SEGS: Seg[][] = [
  ['a', 'b', 'c', 'd', 'e', 'f'],
  ['b', 'c'],
  ['a', 'b', 'g', 'e', 'd'],
  ['a', 'b', 'g', 'c', 'd'],
  ['f', 'g', 'b', 'c'],
  ['a', 'f', 'g', 'c', 'd'],
  ['a', 'f', 'g', 'e', 'c', 'd'],
  ['a', 'b', 'c'],
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  ['a', 'b', 'c', 'd', 'f', 'g'],
]

const OP_STROKES: Record<'+' | '-' | '×', [number, number, number, number][]> = {
  '+': [
    [0, 10, 10, 10],
    [5, 5, 5, 15],
  ],
  '-': [[0, 10, 10, 10]],
  '×': [
    [1, 5, 9, 15],
    [9, 5, 1, 15],
  ],
}

const rnd = (min: number, max: number) => min + Math.random() * (max - min)
const r2 = (n: number) => Math.round(n * 100) / 100

function strokesToPath(strokes: [number, number, number, number][]): string {
  return strokes.map(([x1, y1, x2, y2]) => `M${x1} ${y1}L${x2} ${y2}`).join('')
}

/** Um glifo com transformação própria — nada fica alinhado com nada. */
function glifo(
  strokes: [number, number, number, number][],
  cx: number,
  cor: string,
  peso: number,
): string {
  const rot = r2(rnd(-16, 16))
  const escala = r2(rnd(0.85, 1.12))
  const dy = r2(rnd(-6, 6))
  const skew = r2(rnd(-8, 8))
  const cy = H / 2

  return (
    `<g transform="translate(${r2(cx)} ${r2(cy + dy)}) rotate(${rot}) scale(${escala}) skewX(${skew}) translate(-5 -10)">` +
    `<path d="${strokesToPath(strokes)}" fill="none" stroke="${cor}" stroke-width="${peso}" ` +
    `stroke-linecap="round" stroke-linejoin="round"/></g>`
  )
}

/** Squiggles bezier atravessando a imagem. */
function ruidoLinhas(qtd: number, opacidade: number): string {
  let out = ''
  for (let i = 0; i < qtd; i++) {
    const y = rnd(0, H)
    const d =
      `M${r2(rnd(-10, 20))} ${r2(y)} ` +
      `C${r2(rnd(40, 100))} ${r2(rnd(0, H))}, ` +
      `${r2(rnd(120, 200))} ${r2(rnd(0, H))}, ` +
      `${r2(W + rnd(-20, 10))} ${r2(rnd(0, H))}`
    const cor = ['#9146ff', '#bf94ff', '#5c16c5', '#e5d4ff'][randomInt(4)]
    out += `<path d="${d}" fill="none" stroke="${cor}" stroke-width="${r2(rnd(0.8, 2))}" opacity="${opacidade}"/>`
  }
  return out
}

function ruidoPontos(qtd: number): string {
  let out = ''
  for (let i = 0; i < qtd; i++) {
    out +=
      `<circle cx="${r2(rnd(0, W))}" cy="${r2(rnd(0, H))}" r="${r2(rnd(0.6, 2))}" ` +
      `fill="#bf94ff" opacity="${r2(rnd(0.12, 0.4))}"/>`
  }
  return out
}

export type DesafioCaptcha = {
  /** Resposta correta, em string. Fica SÓ no servidor. */
  resposta: string
  /**
   * Markup SVG puro (não um data URI). Fica gravado no banco e é servido por
   * /api/captcha/[id]/imagem como `image/svg+xml` de verdade — embrulhar isso
   * em base64 dentro de um JSON gigante se mostrou instável em trânsito.
   */
  imagemSvg: string
  /**
   * Enunciado em texto ("7 + 3"). SÓ PARA LOG/DEBUG NO SERVIDOR — mandar isso
   * para o client mataria o captcha, já que o bot leria a conta pronta em vez
   * de precisar interpretar a imagem.
   */
  enunciado: string
}

export function gerarDesafioCaptcha(): DesafioCaptcha {
  const op = (['+', '-', '×'] as const)[randomInt(3)]

  let a: number
  let b: number
  let resultado: number

  if (op === '+') {
    a = randomInt(2, 10)
    b = randomInt(2, 10)
    resultado = a + b
  } else if (op === '-') {
    a = randomInt(5, 16)
    b = randomInt(1, a - 1)
    resultado = a - b
  } else {
    a = randomInt(2, 6)
    b = randomInt(2, 6)
    resultado = a * b
  }

  const digitosA = String(a).split('')
  const digitosB = String(b).split('')

  // Espaçamento agrupado: dígitos do mesmo número ficam juntinhos e o operador
  // ganha respiro dos dois lados. Com passo uniforme, "13 - 5" acabava lido
  // como "1 3 - 5".
  const PASSO_DIGITO = 24
  const PASSO_OPERADOR = 48

  const itens: [number, number, number, number][][] = [
    ...digitosA.map(segsDoDigito),
    OP_STROKES[op],
    ...digitosB.map(segsDoDigito),
  ]
  const indiceOperador = digitosA.length

  const centros: number[] = []
  let x = 0
  for (let k = 0; k < itens.length; k++) {
    if (k > 0) {
      // Passo largo ao entrar e ao sair do operador.
      const vizinhoDoOperador = k === indiceOperador || k === indiceOperador + 1
      x += vizinhoDoOperador ? PASSO_OPERADOR : PASSO_DIGITO
    }
    centros.push(x)
  }

  const deslocamento = (W - x) / 2
  const paleta = ['#f2e9ff', '#e5d4ff', '#ffffff', '#d9bbff']

  let glifos = ''
  for (let k = 0; k < itens.length; k++) {
    const cx = deslocamento + centros[k] + rnd(-3, 3)
    glifos += glifo(itens[k], cx, paleta[randomInt(paleta.length)], r2(rnd(3, 4.6)))
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="#1a1329"/><stop offset="100%" stop-color="#2a1b47"/>` +
    `</linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>` +
    ruidoPontos(45) +
    ruidoLinhas(3, 0.35) +
    glifos +
    ruidoLinhas(2, 0.55) +
    `</svg>`

  return {
    resposta: String(resultado),
    imagemSvg: svg,
    enunciado: `${a} ${op} ${b}`,
  }
}

function segsDoDigito(d: string): [number, number, number, number][] {
  const segs = DIGIT_SEGS[Number(d)]
  return segs.map((s) => SEG_COORDS[s])
}
