import type { Metadata, Viewport } from 'next';
import './globals.css';
import './v07.css';
import './v17.css';
import './mobile.css';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export const metadata: Metadata = {
  metadataBase: new URL('https://krage.pacify.site'),
  title: 'KRAGE | Free Multiplayer Browser FPS Game',
  description:
    'Play KRAGE, a free multiplayer browser FPS. Jump into quick play, create a lobby with friends, or practice against bots. No download required.',
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
    title: 'KRAGE | Free Multiplayer Browser FPS Game',
    description:
      'Play with friends in KRAGE, a free browser first person shooter. FFA, 1v1, 2v2, and 3v3, with bots or friends, across four maps.',
    url: 'https://krage.pacify.site',
    siteName: 'KRAGE',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/social-card.png',
        width: 1200,
        height: 630,
        alt: 'KRAGE: free multiplayer browser FPS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KRAGE | Free Multiplayer Browser FPS Game',
    description:
      'Play with friends in KRAGE, a free browser first person shooter. FFA, 1v1, 2v2, and 3v3, with bots or friends.',
    images: ['/social-card.png'],
  },
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/krage-logo-128.png',
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
