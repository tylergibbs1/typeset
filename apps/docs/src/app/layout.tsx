import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import { JetBrains_Mono } from 'next/font/google';
import './global.css';

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata = {
  title: {
    default: 'Typeset',
    template: '%s — Typeset',
  },
  description: 'Deterministic document pipelines — render, verify, extract',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={mono.variable} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--paper, #fafaf9)' }}>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
