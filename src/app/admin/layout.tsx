import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin — Melhor Membro',
  robots: { index: false, follow: false },
}

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return children
}
