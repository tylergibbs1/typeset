import { docs, meta } from '@/.source';
import { loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';

const mdxSource = createMDXSource(docs, meta);

export const source = loader({
  baseUrl: '/docs',
  source: {
    // fumadocs-mdx v11 returns files as a function, fumadocs-core v15 expects an array
    files: typeof mdxSource.files === 'function' ? (mdxSource.files as Function)() : mdxSource.files,
  },
});
