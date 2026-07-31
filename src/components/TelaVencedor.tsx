'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import Confete from './Confete'

/**
 * Tela final, mostrada quando o admin anuncia o vencedor em /admin. Some tudo
 * o resto (formulário, placar) — só fica o nome/foto do vencedor e a música
 * `public/winner.mp3` tocando de fundo.
 *
 * Áudio não tem o mesmo truque de "autoplay mudo" do vídeo — sem som, tocar
 * sozinho não serve pra nada. Por isso o play depende de um clique de
 * verdade (o gesto que os navegadores exigem pra liberar áudio); tentamos o
 * autoplay uma vez ao montar por via das dúvidas, mas o botão é o caminho
 * garantido.
 */
export default function TelaVencedor({
  nome,
  fotoUrl,
  twitchUrl,
}: {
  nome: string
  fotoUrl: string
  twitchUrl: string
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [confete, setConfete] = useState(0)
  const [tocando, setTocando] = useState(false)
  const [audioIndisponivel, setAudioIndisponivel] = useState(false)

  useEffect(() => {
    setConfete((n) => n + 1)
    audioRef.current
      ?.play()
      .then(() => setTocando(true))
      .catch(() => setTocando(false))
  }, [])

  const alternarMusica = () => {
    const audio = audioRef.current
    if (!audio) return
    if (tocando) {
      audio.pause()
      setTocando(false)
    } else {
      audio.play().then(() => setTocando(true))
    }
  }

  return (
    <>
      <Confete gatilho={confete} />
      <section className="mx-auto max-w-lg text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-ouro/40 bg-ouro/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-ouro">
          <span>🏆</span> Resultado final
        </p>

        <div className="superficie superficie-twitch anim-entrar mt-5 rounded-3xl p-8 sm:p-10">
          <div className="anim-flutuar text-5xl">👑</div>

          <div className="relative mx-auto mt-4 h-36 w-36 sm:h-44 sm:w-44">
            <Image
              src={fotoUrl}
              alt={nome}
              fill
              sizes="180px"
              className="rounded-full object-cover ring-4 ring-ouro shadow-2xl shadow-ouro/30"
            />
          </div>

          <h1 className="font-display mt-5 text-3xl font-semibold sm:text-5xl">@{nome}</h1>
          <p className="mt-1 text-sm font-bold uppercase tracking-widest text-ouro">
            é o melhor membro 🎉
          </p>

          <a
            href={twitchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block text-xs text-white/40 underline decoration-dotted underline-offset-4 transition hover:text-twitch-light"
          >
            ver o canal na Twitch ↗
          </a>

          {!audioIndisponivel && (
            <div className="mt-7">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                ref={audioRef}
                src="/winner.mp3"
                loop
                onError={() => setAudioIndisponivel(true)}
              />
              <button
                type="button"
                onClick={alternarMusica}
                className="anim-brilho inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-twitch to-twitch-deep px-6 py-3 font-bold transition hover:brightness-110"
              >
                {tocando ? '🔊 Tocando... (pausar)' : '▶️ Tocar música'}
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
