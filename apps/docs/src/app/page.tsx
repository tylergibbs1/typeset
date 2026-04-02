import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24">
      <p className="typeset-logo text-5xl mb-6">typeset</p>
      <p className="text-lg text-fd-muted-foreground max-w-md text-center">
        Deterministic document pipelines.
        <br />
        Render. Verify. Extract.
      </p>
      <div className="flex gap-4 mt-10">
        <Link
          href="/docs"
          className="rounded-md bg-fd-primary px-6 py-3 text-fd-primary-foreground font-medium"
        >
          Documentation
        </Link>
        <Link
          href="/docs/api/render"
          className="rounded-md border border-fd-border px-6 py-3 font-medium"
        >
          API Reference
        </Link>
      </div>
      <div className="mt-16 max-w-lg w-full rounded-lg p-6 font-mono text-sm text-slate-300" style={{ backgroundColor: 'var(--code-bg)' }}>
        <div className="text-slate-500">{'// render a PDF in one call'}</div>
        <div>
          <span className="text-purple-400">curl</span>{' '}
          <span className="text-amber-400">-X POST</span>{' '}
          <span className="text-cyan-400">localhost:3000/v1/render</span>
        </div>
        <div>
          {'  '}<span className="text-amber-400">-d</span>{' '}
          <span className="text-green-300">
            {"'{\"template\": \"<h1>{{name}}</h1>\"}'"}
          </span>
        </div>
      </div>
    </main>
  );
}
