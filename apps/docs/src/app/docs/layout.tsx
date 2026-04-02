import type { ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      nav={{
        title: <span className="typeset-logo text-lg">typeset</span>,
      }}
      sidebar={{
        tabs: [
          {
            title: 'Guide',
            description: 'Learn the basics',
            url: '/docs',
          },
          {
            title: 'API Reference',
            description: 'Endpoints & schemas',
            url: '/docs/api',
          },
        ],
      }}
    >
      {children}
    </DocsLayout>
  );
}
