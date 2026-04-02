import { source } from '@/lib/source';
import { notFound } from 'next/navigation';
import {
  PageRoot,
  PageArticle,
  PageBreadcrumb,
  PageTOC,
  PageTOCItems,
} from 'fumadocs-ui/layouts/docs/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const Mdx = page.data.body;

  return (
    <PageRoot>
      <PageArticle>
        <PageBreadcrumb />
        <h1 className="text-3xl font-bold mb-2">{page.data.title}</h1>
        {page.data.description && (
          <p className="text-fd-muted-foreground mb-8 text-lg">{page.data.description}</p>
        )}
        <Mdx components={{ ...defaultMdxComponents }} />
      </PageArticle>
      <PageTOC items={page.data.toc}>
        <PageTOCItems />
      </PageTOC>
    </PageRoot>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}
