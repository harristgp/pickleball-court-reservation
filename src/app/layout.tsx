import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';

/**
 * Fonts are self-hosted by `next/font`: the files are downloaded at build time
 * and served from the same origin, so there is no render-blocking request to
 * Google and no layout shift. Each exposes a CSS variable that
 * `tailwind.config.ts` maps onto `font-sans` and `font-display`.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dink Club | Pickleball Court Reservations',
  description:
    'Reserve one of four pickleball courts by the hour. Live availability, instant confirmation, and an admin view of every booking.',
};

export const viewport: Viewport = {
  themeColor: '#528c14',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen bg-slate-50 font-sans">{children}</body>
    </html>
  );
}
