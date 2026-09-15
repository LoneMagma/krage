import type { Metadata } from 'next';
import './globals.css';
import './v07.css';
export const metadata: Metadata = {
  title: 'kRAGE',
  description: 'kRAGE. Arena FPS.',
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
