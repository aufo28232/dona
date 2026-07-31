'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import Contagem from '@/components/Contagem'

type FaseVotacao = 'fechada' | 'aberta' | 'encerrada'

type EstadoVotacao = {
  fase: FaseVotacao
  iniciadaEm: string | null
  terminaEm: string | null
  vencedorId: number | null
  anunciadoEm: string | null
}

type Candidato = { id: number; nome: string; fotoUrl: string }
type LinhaRanking = { id: number; nome: string; votos: number; posicao: number }

type Painel = {
  estado: EstadoVotacao
  candidatos: Candidato[]
  ranking: LinhaRanking[]
  totalVotos: number
}

const RESET_FRASE = 'RESETAR'

const LABEL_FASE: Record<FaseVotacao, string> = {
  fechada: '🔒 Urna fechada',
  aberta: '🗳️ Votação aberta',
  encerrada: '🏆 Resultado anunciado',
}

export default function PaginaAdmin() {
  const [carregando, setCarregando] = useState(true)
  const [logado, setLogado] = useState(false)
  const [senha, setSenha] = useState('')
  const [erroLogin, setErroLogin] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  const [painel, setPainel] = useState<Painel | null>(null)
  const [acao, setAcao] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  const [vencedorEscolhido, setVencedorEscolhido] = useState<number | ''>('')
  const [confirmandoReset, setConfirmandoReset] = useState(false)
  const [fraseReset, setFraseReset] = useState('')

  const buscarPainel = useCallback(async () => {
    const res = await fetch('/api/admin/painel', { cache: 'no-store' })
    if (res.status === 401) {
      setLogado(false)
      setPainel(null)
      return
    }
    const dados = (await res.json()) as Painel
    setLogado(true)
    setPainel(dados)
    if (dados.estado.vencedorId) setVencedorEscolhido(dados.estado.vencedorId)
  }, [])

  useEffect(() => {
    void buscarPainel().finally(() => setCarregando(false))
  }, [buscarPainel])

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroLogin(null)
    setEntrando(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErroLogin(dados.erro ?? 'Não deu pra entrar.')
        return
      }
      setSenha('')
      await buscarPainel()
    } catch {
      setErroLogin('Sem conexão com o servidor.')
    } finally {
      setEntrando(false)
    }
  }

  const sair = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {})
    setLogado(false)
    setPainel(null)
  }

  const chamar = async (rota: string, corpo?: Record<string, unknown>) => {
    setAcao(rota)
    setMensagem(null)
    setErroAcao(null)
    try {
      const res = await fetch(`/api/admin/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: corpo ? JSON.stringify(corpo) : undefined,
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErroAcao(dados.erro ?? 'Deu ruim.')
        return
      }
      setMensagem('Feito ✅')
      await buscarPainel()
      setConfirmandoReset(false)
      setFraseReset('')
    } catch {
      setErroAcao('Sem conexão com o servidor.')
    } finally {
      setAcao(null)
    }
  }

  if (carregando) {
    return <div className="superficie mx-auto h-52 max-w-md animate-pulse rounded-3xl" />
  }

  // ---- Tela de login --------------------------------------------------------
  if (!logado || !painel) {
    return (
      <div className="mx-auto max-w-sm">
        <div className="superficie superficie-twitch rounded-3xl p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-twitch to-twitch-deep text-2xl shadow-lg shadow-twitch/30">
            🛠️
          </div>
          <h1 className="font-display mt-4 text-2xl font-semibold">Painel do admin</h1>
          <p className="mt-1 text-sm text-white/50">Digita a senha pra controlar a votação.</p>

          <form onSubmit={entrar} className="mt-6 space-y-3 text-left">
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha"
              className="w-full rounded-xl border border-white/10 bg-ink-3/80 px-3.5 py-3 text-center text-lg tracking-widest outline-none transition placeholder:text-white/25 focus:border-twitch focus:ring-2 focus:ring-twitch/30"
            />
            {erroLogin && (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200">
                {erroLogin}
              </p>
            )}
            <button
              type="submit"
              disabled={entrando || !senha}
              className="font-display w-full rounded-2xl bg-gradient-to-r from-twitch to-twitch-deep px-6 py-3.5 font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {entrando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ---- Painel -----------------------------------------------------------
  const { estado, candidatos, ranking, totalVotos } = painel
  const topo = ranking.slice(0, 5)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Painel do admin</h1>
        <button
          type="button"
          onClick={() => void sair()}
          className="rounded-full px-3.5 py-2 text-xs font-bold text-white/40 transition hover:bg-white/[0.06] hover:text-white/70"
        >
          sair
        </button>
      </div>

      {/* Estado atual */}
      <div className="superficie superficie-twitch rounded-3xl p-6 text-center">
        <p className="font-display text-xl font-semibold">{LABEL_FASE[estado.fase]}</p>
        {estado.fase === 'aberta' && estado.terminaEm && (
          <p className="mt-1 text-sm text-white/60">
            encerra em{' '}
            <Contagem
              alvo={new Date(estado.terminaEm).getTime()}
              className="font-mono font-bold tabular-nums text-twitch-light"
            />
          </p>
        )}
        <p className="mt-3 text-sm text-white/50">
          <span className="font-bold text-twitch-light">{totalVotos}</span> voto{totalVotos === 1 ? '' : 's'}
          {' '}até agora
        </p>
      </div>

      {mensagem && (
        <p className="rounded-xl border border-twitch/30 bg-twitch/10 px-4 py-2.5 text-sm font-semibold text-twitch-light">
          {mensagem}
        </p>
      )}
      {erroAcao && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200">
          {erroAcao}
        </p>
      )}

      {/* Controle do timer */}
      <div className="superficie space-y-3 rounded-3xl p-6">
        <h2 className="font-display text-lg font-semibold">Timer da votação (48h)</h2>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={acao !== null}
            onClick={() => void chamar('abrir')}
            className="flex-1 rounded-2xl bg-gradient-to-r from-twitch to-twitch-deep px-5 py-3 text-sm font-bold shadow-lg shadow-twitch/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {estado.fase === 'aberta' ? '🔄 Reiniciar votação (48h)' : '▶️ Abrir votação (48h)'}
          </button>
          <button
            type="button"
            disabled={acao !== null || estado.fase === 'fechada'}
            onClick={() => void chamar('fechar')}
            className="flex-1 rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold transition hover:border-red-400/50 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ⏸️ Fechar votação
          </button>
        </div>
      </div>

      {/* Anunciar vencedor */}
      <div className="superficie space-y-3 rounded-3xl p-6">
        <h2 className="font-display text-lg font-semibold">Anunciar vencedor</h2>
        <p className="text-xs text-white/45">
          A home passa a mostrar só o nome/foto do vencedor + o vídeo de comemoração.
        </p>

        {topo.length > 0 && (
          <p className="text-xs text-white/40">
            líder atual:{' '}
            <span className="font-bold text-twitch-light">
              {topo[0].nome} ({topo[0].votos} voto{topo[0].votos === 1 ? '' : 's'})
            </span>
          </p>
        )}

        <select
          value={vencedorEscolhido}
          onChange={(e) => setVencedorEscolhido(e.target.value ? Number(e.target.value) : '')}
          className="w-full rounded-xl border border-white/10 bg-ink-3/80 px-3.5 py-3 text-sm outline-none transition focus:border-twitch focus:ring-2 focus:ring-twitch/30"
        >
          <option value="">Escolhe o candidato...</option>
          {candidatos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={acao !== null || !vencedorEscolhido}
            onClick={() => void chamar('anunciar', { streamerId: vencedorEscolhido })}
            className="flex-1 rounded-2xl bg-gradient-to-r from-ouro to-bronze px-5 py-3 text-sm font-bold text-ink shadow-lg shadow-ouro/30 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            🏆 Anunciar vencedor
          </button>
          {estado.fase === 'encerrada' && (
            <button
              type="button"
              disabled={acao !== null}
              onClick={() => void chamar('desanunciar')}
              className="flex-1 rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold transition hover:border-twitch/50 hover:bg-twitch/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↩️ Desfazer anúncio
            </button>
          )}
        </div>
      </div>

      {/* Reset perigoso */}
      <div className="superficie space-y-3 rounded-3xl border-red-500/20 p-6">
        <h2 className="font-display text-lg font-semibold text-red-300">Zona de perigo</h2>
        <p className="text-xs text-white/45">
          Apaga TODOS os votos, tentativas e captchas, e fecha a urna de novo do zero. Não dá pra
          desfazer.
        </p>

        {!confirmandoReset ? (
          <button
            type="button"
            onClick={() => setConfirmandoReset(true)}
            className="w-full rounded-2xl border border-red-500/40 px-5 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/10"
          >
            🗑️ Resetar dados
          </button>
        ) : (
          <div className="space-y-2.5 rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-4">
            <p className="text-xs text-red-200">
              Digita <span className="font-mono font-bold">{RESET_FRASE}</span> pra confirmar:
            </p>
            <input
              type="text"
              value={fraseReset}
              onChange={(e) => setFraseReset(e.target.value)}
              className="w-full rounded-xl border border-red-500/30 bg-ink-3/80 px-3.5 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/30"
            />
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={acao !== null || fraseReset !== RESET_FRASE}
                onClick={() => void chamar('resetar', { confirmar: fraseReset })}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirmar reset
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmandoReset(false)
                  setFraseReset('')
                }}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold transition hover:bg-white/[0.06]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ranking rápido */}
      {topo.length > 0 && (
        <div className="superficie space-y-2 rounded-3xl p-6">
          <h2 className="font-display text-lg font-semibold">Top 5 agora</h2>
          <ol className="space-y-1.5 text-sm">
            {topo.map((l) => {
              const foto = candidatos.find((c) => c.id === l.id)?.fotoUrl
              return (
                <li key={l.id} className="flex items-center gap-2.5">
                  <span className="w-5 shrink-0 font-mono text-white/35">{l.posicao}º</span>
                  {foto && (
                    <Image src={foto} alt="" width={22} height={22} className="h-[22px] w-[22px] shrink-0 rounded-full object-cover" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-bold">{l.nome}</span>
                  <span className="shrink-0 text-twitch-light">{l.votos}</span>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}
