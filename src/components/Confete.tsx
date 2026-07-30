'use client'

import { useEffect, useRef } from 'react'

type Particula = {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vrot: number
  w: number
  h: number
  cor: string
}

const CORES = ['#9146ff', '#bf94ff', '#ffd45e', '#ffffff', '#e5d4ff', '#5c16c5']

/**
 * Confete em canvas, sem dependência externa. Dispara quando `gatilho` muda de
 * valor (e não no primeiro render, senão pipoca confete a cada navegação).
 */
export default function Confete({ gatilho }: { gatilho: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const primeiro = useRef(true)

  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const largura = canvas.clientWidth
    const altura = canvas.clientHeight
    canvas.width = largura * dpr
    canvas.height = altura * dpr
    ctx.scale(dpr, dpr)

    const particulas: Particula[] = Array.from({ length: 140 }, () => ({
      x: largura / 2 + (Math.random() - 0.5) * largura * 0.6,
      y: altura * 0.35 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -11 - 3,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.3,
      w: 5 + Math.random() * 7,
      h: 8 + Math.random() * 9,
      cor: CORES[Math.floor(Math.random() * CORES.length)],
    }))

    let raf = 0
    let quadro = 0
    const MAX_QUADROS = 220

    const tick = () => {
      quadro++
      ctx.clearRect(0, 0, largura, altura)

      for (const p of particulas) {
        p.vy += 0.32 // gravidade
        p.vx *= 0.99 // arrasto
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vrot

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = Math.max(0, 1 - quadro / MAX_QUADROS)
        ctx.fillStyle = p.cor
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      if (quadro < MAX_QUADROS) {
        raf = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, largura, altura)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [gatilho])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  )
}
