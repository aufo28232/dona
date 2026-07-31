import { randomInt } from 'node:crypto'

/**
 * Captcha caseiro, em TEXTO puro ("7 + 3", resolve e digita o resultado).
 *
 * Existiu uma versão anterior que desenhava a continha como SVG (pra um bot
 * não conseguir ler a resposta direto do markup). Na prática o SVG dava
 * problema de renderização em produção e o valor real de defesa contra bot
 * preguiçoso já vem das outras camadas (login obrigatório com a Twitch, rate
 * limit por IP, honeypot, tempo mínimo de preenchimento) — então trocamos
 * para texto simples, que é o que o projeto precisa sem o risco de quebrar.
 */

export type DesafioCaptcha = {
  /** Resposta correta, em string. Fica SÓ no servidor. */
  resposta: string
  /** Enunciado em texto ("7 + 3"), mostrado direto pro usuário resolver. */
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

  return {
    resposta: String(resultado),
    enunciado: `${a} ${op} ${b}`,
  }
}
