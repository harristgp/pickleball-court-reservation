import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Navbar } from '@/components/layout/Navbar';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'pcourt — Pickleball court booking',
    template: '%s · pcourt',
  },
  description:
    'Find pickleball courts near you, book a time slot, and pay by QR with receipt verification from the owner.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        <footer className="mt-16 border-t border-zinc-200 py-8">
          <p className="mx-auto max-w-7xl px-4 text-xs text-zinc-500 sm:px-6 lg:px-8">
            pcourt — court reservations with manual QR payment verification.
          </p>
        </footer>
      </body>
    </html>
  );
}
