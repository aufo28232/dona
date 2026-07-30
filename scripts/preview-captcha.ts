/**
 * Utilitário de conferência visual do captcha. Não faz parte do site.
 *   npx tsx scripts/preview-captcha.ts
 * Gera scripts/captcha-preview.html com alguns desafios e suas respostas.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gerarDesafioCaptcha } from '../src/lib/captcha-image'

const amostras = Array.from({ length: 12 }, () => gerarDesafioCaptcha())

for (const a of amostras) {
  console.log(`${a.enunciado.padEnd(10)} = ${a.resposta}`)
}

const html = `<!doctype html><meta charset="utf-8">
<body style="background:#0b0713;color:#eee;font-family:system-ui;padding:24px">
<h1>Prévia do captcha</h1>
${amostras
  .map(
    (a) =>
      `<figure style="display:inline-block;margin:8px">
         <img src="${a.imagemDataUri}" width="240" height="90">
         <figcaption style="font-size:12px;opacity:.6">${a.enunciado} = ${a.resposta}</figcaption>
       </figure>`,
  )
  .join('')}
</body>`

const destino = join(process.cwd(), 'scripts', 'captcha-preview.html')
writeFileSync(destino, html, 'utf8')
console.log(`\nAbra: ${destino}`)
