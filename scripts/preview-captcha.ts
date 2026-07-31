/**
 * Utilitário de conferência do captcha (agora em texto puro, sem SVG).
 *   npx tsx scripts/preview-captcha.ts
 */
import { gerarDesafioCaptcha } from '../src/lib/captcha'

const amostras = Array.from({ length: 12 }, () => gerarDesafioCaptcha())

for (const a of amostras) {
  console.log(`${a.enunciado.padEnd(10)} = ${a.resposta}`)
}
