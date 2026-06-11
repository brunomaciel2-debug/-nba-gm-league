import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'NBA GM League 2025-26',
  description: 'The ultimate NBA General Manager simulation league',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ background: '#1a1610', color: '#f0ebe0' }}>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}
