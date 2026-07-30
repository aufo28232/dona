import type { Metadata, Viewport } from 'next'
import { Fredoka, Plus_Jakarta_Sans } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Melhor Membro da Live da Dona',
  description:
    'A eleição mais séria da internet: vote no melhor membro da live da Dona. Um voto a cada 2 horas.',
  openGraph: {
    title: 'Melhor Membro da Live da Dona 🏆',
    description: 'Vote no melhor membro da live da Dona. Um voto a cada 2 horas, sem chorar.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#0c0716',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fredoka.variable} ${jakarta.variable}`}>
      <body className="antialiased">
        <div className="bg-cena" aria-hidden="true" />

        <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink/75 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-twitch to-twitch-deep text-lg shadow-lg shadow-twitch/30">
                🏆
              </span>
              <span className="font-display text-[15px] font-semibold leading-tight tracking-tight sm:text-base">
                Melhor Membro
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-twitch-light sm:text-[11px]">
                  da live da Dona
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-1.5 text-xs font-bold sm:text-sm">
              <Link
                href="/"
                className="rounded-full px-3.5 py-2 text-white/60 transition hover:bg-white/[0.06] hover:text-white"
              >
                Votar
              </Link>
              <Link
                href="/ranking"
                className="rounded-full bg-gradient-to-r from-twitch to-twitch-deep px-4 py-2 text-white shadow-lg shadow-twitch/30 transition hover:brightness-110"
              >
                Placar
              </Link>
            </div>
          </nav>
        </header>

        <main className="relative mx-auto max-w-5xl px-4 pb-20 pt-8 sm:pt-12">{children}</main>

        <footer className="relative mx-auto max-w-5xl px-4 pb-10 text-center text-[11px] leading-relaxed text-white/35">
          <p>
            O telefone é coletado apenas para fins de organização da votação. Não é divulgado, não
            aparece em nenhuma página e não é usado para mais nada.
          </p>
          <p className="mt-2">
            Feito pela comunidade, na zoeira. 💜 Um voto a cada 2 horas — não adianta insistir.
          </p>
        </footer>
      </body>
    </html>
  )
}
