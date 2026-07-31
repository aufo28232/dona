'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import Confete from './Confete'
import Contagem from './Contagem'
import { mascararTelefone, validarTelefone } from '@/lib/validation'

export type CandidatoPublico = {
  id: number
  nome: string
  twitchUrl: string
  fotoUrl: string
}

type Captcha = { id: string; enunciado: string; expiraEm: string }

type Sessao = { logado: true; login: string; nomeExibicao: string; avatarUrl: string } | { logado: false }

type Estado = 'carregando' | 'deslogado' | 'ocioso' | 'enviando' | 'sucesso' | 'cooldown'

function Passo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="font-display flex items-center gap-2.5 text-lg font-semibold tracking-tight sm:text-xl">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-twitch to-twitch-deep text-sm font-bold text-white shadow shadow-twitch/30">
        {n}
      </span>
      {children}
    </h2>
  )
}

export default function FormularioVoto({ candidatos }: { candidatos: CandidatoPublico[] }) {
  const [selecionado, setSelecionado] = useState<number | null>(null)
  const [telefone, setTelefone] = useState('')
  const [respostaCaptcha, setRespostaCaptcha] = useState('')
  const [captcha, setCaptcha] = useState<Captcha | null>(null)
  const [carregandoCaptcha, setCarregandoCaptcha] = useState(false)

  const [sessao, setSessao] = useState<Sessao>({ logado: false })
  const [estado, setEstado] = useState<Estado>('carregando')
  const [erro, setErro] = useState<string | null>(null)
  const [campoComErro, setCampoComErro] = useState<string | null>(null)
  const [votadoEm, setVotadoEm] = useState<string | null>(null)
  const [liberaEm, setLiberaEm] = useState<number | null>(null)
  const [confete, setConfete] = useState(0)

  // Honeypots: se vierem preenchidos, foi bot.
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')

  const painelRef = useRef<HTMLFieldSetElement>(null)

  const buscarCaptcha = useCallback(async () => {
    setCarregandoCaptcha(true)
    setRespostaCaptcha('')
    try {
      const res = await fetch('/api/captcha', { method: 'POST' })
      if (!res.ok) {
        setCaptcha(null)
        const corpo = await res.json().catch(() => null)
        setErro(corpo?.erro ?? 'Não consegui gerar o captcha. Tenta recarregar a página.')
        return
      }
      setCaptcha((await res.json()) as Captcha)
    } catch {
      setCaptcha(null)
      setErro('Sem conexão com o servidor. Tenta de novo.')
    } finally {
      setCarregandoCaptcha(false)
    }
  }, [])

  /**
   * Confere cooldown (IP + conta) e sessão da Twitch, e decide em qual tela
   * cair. Reaproveitada na montagem e quando o cooldown zera.
   */
  const verificarEstado = useCallback(async () => {
    try {
      const [resCooldown, resMe] = await Promise.all([fetch('/api/cooldown'), fetch('/api/auth/me')])
      const [cooldown, me] = await Promise.all([resCooldown.json(), resMe.json()])

      if (!cooldown.podeVotar) {
        setEstado('cooldown')
        setLiberaEm(Date.now() + cooldown.msRestantes)
        setSessao(me.logado ? me : { logado: false })
        return
      }

      if (!me.logado) {
        setSessao({ logado: false })
        setEstado('deslogado')
        return
      }

      setSessao(me)
      setEstado('ocioso')
      void buscarCaptcha()
    } catch {
      setEstado('deslogado')
    }
  }, [buscarCaptcha])

  useEffect(() => {
    void verificarEstado()
  }, [verificarEstado])

  // Mensagem de retorno do login (?login=ok|falhou|cancelado) e limpa a URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const resultado = params.get('login')
    if (!resultado) return
    if (resultado === 'falhou') setErro('Não rolou de entrar com a Twitch. Tenta de novo.')
    if (resultado === 'cancelado') setErro('Login cancelado. Sem problema, tenta quando quiser.')
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  const sair = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setSessao({ logado: false })
    setEstado('deslogado')
    setCaptcha(null)
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    setCampoComErro(null)

    if (selecionado === null) {
      setErro('Escolhe um candidato primeiro 👀')
      setCampoComErro('streamer')
      painelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const tel = validarTelefone(telefone)
    if (!tel.ok) {
      setErro(tel.erro)
      setCampoComErro('telefone')
      return
    }

    if (!captcha || !respostaCaptcha.trim()) {
      setErro('Resolve a continha do captcha aí 🧮')
      setCampoComErro('captcha')
      return
    }

    setEstado('enviando')

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamerId: selecionado,
          telefone,
          captchaId: captcha.id,
          captchaResposta: respostaCaptcha,
          email,
          website,
        }),
      })

      const dados = await res.json().catch(() => ({}))

      if (res.ok) {
        setEstado('sucesso')
        setVotadoEm(dados.votadoEm ?? null)
        setLiberaEm(dados.proximoVotoEm ? new Date(dados.proximoVotoEm).getTime() : null)
        setConfete((n) => n + 1)
        return
      }

      if (dados.codigo === 'LOGIN') {
        setSessao({ logado: false })
        setEstado('deslogado')
        setErro('Tua sessão da Twitch expirou. Entra de novo pra votar.')
        return
      }

      if (dados.codigo === 'COOLDOWN') {
        setEstado('cooldown')
        setLiberaEm(Date.now() + (dados.msRestantes ?? 0))
        return
      }

      setEstado('ocioso')
      setErro(dados.erro ?? 'Deu ruim aqui. Tenta de novo.')
      setCampoComErro(dados.campo ?? (dados.codigo === 'CAPTCHA' ? 'captcha' : null))

      // Captcha é de uso único: qualquer falha depois dele queima o token,
      // então sempre pegamos um novo.
      if (dados.codigo === 'CAPTCHA' || res.status === 400) void buscarCaptcha()
    } catch {
      setEstado('ocioso')
      setErro('Não rolou de enviar. Confere tua conexão e tenta de novo.')
    }
  }

  // ---- Tela de sucesso ---------------------------------------------------
  if (estado === 'sucesso') {
    return (
      <>
        <Confete gatilho={confete} />
        <div className="superficie superficie-twitch anim-entrar rounded-3xl p-8 text-center sm:p-10">
          <div className="text-6xl">🎉</div>
          <h2 className="font-display mt-4 text-3xl font-semibold">Voto computado!</h2>
          <p className="mt-2 text-white/65">
            Você votou em{' '}
            <span className="font-bold text-twitch-light">@{votadoEm}</span>. Boa sorte pra ele(a).
          </p>
          {liberaEm && (
            <p className="mt-5 text-sm text-white/50">
              Próximo voto liberado em{' '}
              <Contagem alvo={liberaEm} className="font-mono font-bold text-twitch-light" />
            </p>
          )}
          <Link
            href="/ranking"
            className="mt-6 inline-block rounded-full bg-gradient-to-r from-twitch to-twitch-deep px-6 py-3 font-bold shadow-lg shadow-twitch/30 transition hover:brightness-110"
          >
            Ver o placar 🏆
          </Link>
        </div>
      </>
    )
  }

  // ---- Tela de cooldown --------------------------------------------------
  if (estado === 'cooldown') {
    return (
      <div className="superficie anim-entrar rounded-3xl p-8 text-center sm:p-10">
        <div className="text-6xl">⏳</div>
        <h2 className="font-display mt-4 text-3xl font-semibold">Calma lá, campeão</h2>
        <p className="mt-2 text-white/65">
          É 1 voto a cada 2 horas por conta da Twitch e por conexão. Volta daqui a pouco que a urna
          te espera.
        </p>
        {liberaEm && (
          <div className="mt-6">
            <Contagem
              alvo={liberaEm}
              aoZerar={() => void verificarEstado()}
              className="font-mono text-4xl font-black tabular-nums text-twitch-light"
            />
            <p className="mt-1 text-xs uppercase tracking-widest text-white/40">
              até liberar de novo
            </p>
          </div>
        )}
        <Link
          href="/ranking"
          className="mt-7 inline-block rounded-full bg-gradient-to-r from-twitch to-twitch-deep px-6 py-3 font-bold shadow-lg shadow-twitch/30 transition hover:brightness-110"
        >
          Enquanto isso, olha o placar 🏆
        </Link>
      </div>
    )
  }

  // ---- Formulário --------------------------------------------------------
  const enviando = estado === 'enviando'
  const logado = sessao.logado === true

  return (
    <form onSubmit={enviar} noValidate className="space-y-9">
      {/* Grade de candidatos */}
      <fieldset ref={painelRef}>
        <legend className="sr-only">Escolha um candidato</legend>
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <Passo n={1}>Escolhe teu campeão</Passo>
          <span className="text-xs text-white/35">{candidatos.length} na disputa</span>
        </div>

        <div
          className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${
            campoComErro === 'streamer' ? 'rounded-2xl ring-2 ring-red-500/60' : ''
          }`}
        >
          {candidatos.map((c) => {
            const ativo = selecionado === c.id
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  setSelecionado(c.id)
                  setCampoComErro(null)
                }}
                aria-pressed={ativo}
                className={`group relative flex flex-col items-center gap-2.5 overflow-hidden rounded-2xl p-3.5 text-center transition-all duration-200 ${
                  ativo
                    ? 'superficie-twitch superficie -translate-y-0.5'
                    : 'superficie hover:-translate-y-1 hover:border-twitch/35'
                }`}
              >
                {ativo && (
                  <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-twitch to-twitch-deep text-xs font-black shadow shadow-twitch/40">
                    ✓
                  </span>
                )}
                <div
                  className={`relative aspect-square w-full overflow-hidden rounded-xl ring-2 transition ${
                    ativo ? 'ring-twitch' : 'ring-white/10 group-hover:ring-twitch/40'
                  }`}
                >
                  <Image
                    src={c.fotoUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
                    className="object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
                <span className="w-full truncate text-xs font-bold sm:text-sm">{c.nome}</span>
              </button>
            )
          })}
        </div>

        {selecionado !== null && (
          <a
            href={candidatos.find((c) => c.id === selecionado)?.twitchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs text-white/40 underline decoration-dotted underline-offset-4 transition hover:text-twitch-light"
          >
            ver o canal de @{candidatos.find((c) => c.id === selecionado)?.nome} na Twitch ↗
          </a>
        )}
      </fieldset>

      {/* Login com a Twitch + resto do formulário */}
      {estado === 'carregando' ? (
        <div className="superficie h-44 animate-pulse rounded-3xl" />
      ) : !logado ? (
        <div className="anim-entrar space-y-3">
          <Passo n={2}>Confirma que é você</Passo>
          <div className="superficie superficie-twitch rounded-3xl p-7 text-center sm:p-9">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-twitch to-twitch-deep text-2xl shadow-lg shadow-twitch/30">
              🔒
            </div>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/60">
              Pra votar, entra com tua conta da Twitch. É rapidinho e evita que robô encha a urna
              de voto — a gente só confirma quem é você, não posta nada na tua conta.
            </p>
            <a
              href="/api/auth/twitch"
              className="anim-brilho mt-5 inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-twitch to-twitch-deep px-7 py-3.5 font-bold transition hover:brightness-110"
            >
              <TwitchGlyph className="h-4 w-4" /> Entrar com a Twitch
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="superficie anim-entrar flex items-center justify-between gap-3 rounded-2xl p-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                src={sessao.avatarUrl}
                alt=""
                width={38}
                height={38}
                className="h-[38px] w-[38px] shrink-0 rounded-full ring-2 ring-twitch"
              />
              <div className="min-w-0 text-sm">
                <p className="truncate font-bold">@{sessao.login}</p>
                <p className="flex items-center gap-1 text-[11px] text-white/40">
                  <TwitchGlyph className="h-3 w-3 text-twitch-light" /> logado com a Twitch
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void sair()}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-white/40 transition hover:bg-white/[0.06] hover:text-white/70"
            >
              trocar de conta
            </button>
          </div>

          {/* Telefone */}
          <div className="space-y-4">
            <Passo n={3}>Teu telefone</Passo>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/45">
                Telefone
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={telefone}
                onChange={(e) => {
                  setTelefone(mascararTelefone(e.target.value))
                  setCampoComErro(null)
                }}
                placeholder="(11) 91234-5678"
                className={campoInput(campoComErro === 'telefone')}
              />
              <span className="mt-1.5 block text-[11px] text-white/35">
                Só pra organização da votação. Não aparece em lugar nenhum.
              </span>
            </label>

            {/*
              Honeypots. Ficam fora da tela via CSS (não display:none) para
              autofill de bot cair. tabIndex=-1 e aria-hidden mantêm teclado e
              leitor de tela longe deles.
            */}
            <div className="honeypot" aria-hidden="true">
              <label>
                E-mail
                <input
                  type="email"
                  name="email"
                  tabIndex={-1}
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Site
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Captcha */}
          <div className="space-y-3">
            <Passo n={4}>Prova que não é robô</Passo>

            <div className="superficie flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                {carregandoCaptcha ? (
                  <div className="h-[90px] w-[150px] animate-pulse rounded-xl bg-ink-4" />
                ) : captcha ? (
                  <div className="flex h-[90px] w-[150px] shrink-0 items-center justify-center rounded-xl border border-twitch/25 bg-gradient-to-br from-ink-3 to-ink-4 shadow-inner">
                    <span className="font-display select-none text-3xl font-bold tracking-wide text-twitch-light">
                      {captcha.enunciado}
                    </span>
                  </div>
                ) : (
                  <div className="flex h-[90px] w-[150px] items-center justify-center rounded-xl border border-white/10 bg-ink-3 text-xs text-white/40">
                    captcha indisponível
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void buscarCaptcha()}
                  title="Gerar outro captcha"
                  className="shrink-0 rounded-full border border-white/10 p-2.5 text-lg transition hover:border-twitch/50 hover:bg-twitch/10"
                >
                  🔄
                </button>
              </div>

              <label className="flex-1">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/45">
                  Quanto dá?
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={respostaCaptcha}
                  onChange={(e) => {
                    setRespostaCaptcha(e.target.value.replace(/\D/g, '').slice(0, 3))
                    setCampoComErro(null)
                  }}
                  placeholder="resultado"
                  className={campoInput(campoComErro === 'captcha')}
                />
              </label>
            </div>
          </div>

          {erro && (
            <p
              role="alert"
              className="anim-entrar rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200"
            >
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="font-display anim-brilho w-full rounded-2xl bg-gradient-to-r from-twitch to-twitch-deep px-6 py-4 text-lg font-semibold tracking-tight transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? 'Computando...' : 'VOTAR 🗳️'}
          </button>

          <p className="text-center text-[11px] text-white/35">
            1 voto a cada 2 horas por conta da Twitch e por conexão. Sim, a gente checa. 👁️
          </p>
        </>
      )}

      {!logado && erro && (
        <p
          role="alert"
          className="anim-entrar rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200"
        >
          {erro}
        </p>
      )}
    </form>
  )
}

function campoInput(temErro: boolean): string {
  return `w-full rounded-xl border bg-ink-3/80 px-3.5 py-3 text-[15px] outline-none transition placeholder:text-white/25 focus:border-twitch focus:ring-2 focus:ring-twitch/30 ${
    temErro ? 'border-red-500/70' : 'border-white/10'
  }`
}

function TwitchGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.3 2 3 5.7v14.6h5v2.3h3l2.3-2.3h3.6L22 15.1V2H4.3Zm2 2h13.6v10l-3 3h-4l-2.3 2.3V17H6.3V4Zm4.2 8.5h2V6.8h-2v5.7Zm5.4 0h2V6.8h-2v5.7Z" />
    </svg>
  )
}
