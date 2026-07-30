'use client'

import { useEffect, useState } from 'react'

export function formatarDuracao(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/**
 * Conta regressiva até `alvo`. Recebe timestamp em ms para evitar o clássico
 * mismatch de hidratação de renderizar "agora" no servidor e outro "agora" no
 * client — o valor só aparece depois que monta.
 */
export default function Contagem({
  alvo,
  aoZerar,
  className,
}: {
  alvo: number
  aoZerar?: () => void
  className?: string
}) {
  const [restante, setRestante] = useState<number | null>(null)

  useEffect(() => {
    let zerou = false

    const atualizar = () => {
      const ms = alvo - Date.now()
      setRestante(ms)
      if (ms <= 0 && !zerou) {
        zerou = true
        aoZerar?.()
      }
    }

    atualizar()
    const id = setInterval(atualizar, 1000)
    return () => clearInterval(id)
    // aoZerar de propósito fora das deps: é sempre uma função nova a cada
    // render do pai e reiniciaria o intervalo toda hora.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo])

  return (
    <span className={className} suppressHydrationWarning>
      {restante === null ? '--:--' : formatarDuracao(restante)}
    </span>
  )
}
