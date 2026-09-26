import type { Metadata } from 'next';
import './globals.css';
import './v07.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://krage.pacify.site'),
  title: 'KRAGE',
  description:
    'Play with friends in kRAGE, a free browser first person shooter. No download, no install. FFA, 1v1, 2v2, or 3v3 across four maps with bots or friends.',
  keywords: [
    'kRAGE',
    'browser FPS',
    'arena shooter',
    'free online FPS',
    'no download FPS game',
    'multiplayer shooter browser',
    'web FPS game',
  ],
  authors: [{ name: 'LoneMagma' }],
  creator: 'LoneMagma',
  publisher: 'Pacify',
  applicationName: 'KRAGE',
  alternates: {
    canonical: 'https://krage.pacify.site',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'KRAGE',
    description:
      'Play with friends in kRAGE, a free browser first person shooter. FFA, 1v1, 2v2, and 3v3, with bots or friends, across four maps.',
    url: 'https://krage.pacify.site',
    siteName: 'KRAGE',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/social-card.png',
        width: 1200,
        height: 630,
        alt: 'kRAGE browser arena shooter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KRAGE',
    description:
      'Play with friends in kRAGE, a free browser first person shooter. FFA, 1v1, 2v2, and 3v3, with bots or friends.',
    images: ['/social-card.png'],
  },
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-bw.png', type: 'image/png' },
    ],
    apple: '/favicon-bw.png',
  },
  category: 'games',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
