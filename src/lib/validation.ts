/**
 * Validações compartilhadas front/back. O front usa para dar feedback bonito;
 * o back REVALIDA tudo, porque nada que vem do client é confiável.
 */

export type Validacao = { ok: true; valor: string } | { ok: false; erro: string }

/**
 * Telefone BR. Aceita com/sem DDI 55, com/sem máscara. Não é verificado por
 * SMS — é coleta informativa —, então só exigimos que o formato faça sentido.
 * Guardamos normalizado em dígitos puros para não virar uma zona no export.
 */
export function validarTelefone(input: string): Validacao {
  const digitos = input.replace(/\D/g, '')
  if (digitos.length === 0) return { ok: false, erro: 'Coloca teu telefone aí' }

  let nacional = digitos
  if (nacional.length > 11 && nacional.startsWith('55')) nacional = nacional.slice(2)

  if (nacional.length !== 10 && nacional.length !== 11) {
    return { ok: false, erro: 'Telefone precisa ter DDD + número (ex: 11912345678)' }
  }

  const ddd = Number(nacional.slice(0, 2))
  if (ddd < 11 || ddd > 99) return { ok: false, erro: 'DDD inválido' }

  // Celular (11 dígitos) sempre começa com 9. Fixo (10) nunca começa com 0 ou 1.
  if (nacional.length === 11 && nacional[2] !== '9') {
    return { ok: false, erro: 'Celular com 11 dígitos precisa começar com 9 depois do DDD' }
  }
  if (nacional.length === 10 && !/[2-8]/.test(nacional[2])) {
    return { ok: false, erro: 'Número fixo inválido' }
  }

  return { ok: true, valor: nacional }
}

/** Máscara visual pro input, tolerante a digitação parcial. */
export function mascararTelefone(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
