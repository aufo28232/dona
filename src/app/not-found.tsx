import Link from 'next/link'

export default function NaoEncontrado() {
  return (
    <div className="superficie rounded-3xl p-12 text-center">
      <div className="text-6xl">🫥</div>
      <h1 className="font-display mt-4 text-2xl font-semibold">Essa página não existe</h1>
      <p className="mt-2 text-sm text-white/50">Deve ter sido banida do canal.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-full bg-gradient-to-r from-twitch to-twitch-deep px-6 py-3 font-bold shadow-lg shadow-twitch/30 transition hover:brightness-110"
      >
        Voltar pra votação
      </Link>
    </div>
  )
}
