import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4" style={{ paddingTop: 'var(--space-24)', paddingBottom: 'var(--space-24)' }}>
      {/* Logo */}
      <h1 className="typeset-logo" style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>
        typeset
      </h1>

      {/* Tagline */}
      <p className="text-center" style={{ fontSize: '1.125rem', color: 'var(--muted)', maxWidth: '28rem', lineHeight: 1.6 }}>
        Deterministic document pipelines.
        <br />
        Render. Verify. Extract.
      </p>

      {/* CTAs */}
      <div className="flex gap-4" style={{ marginTop: 'var(--space-8)' }}>
        <Link
          href="/docs"
          style={{
            background: 'var(--accent)',
            color: '#ffffff',
            fontWeight: 500,
            fontSize: '14px',
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            transition: 'background var(--duration-normal) var(--easing)',
          }}
        >
          Documentation
        </Link>
        <Link
          href="/docs/api/render"
          style={{
            background: 'var(--white)',
            color: 'var(--ink)',
            fontWeight: 500,
            fontSize: '14px',
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-strong)',
            transition: 'background var(--duration-normal) var(--easing)',
          }}
        >
          API Reference
        </Link>
      </div>

      {/* Code example — sharp corners, terminal style */}
      <div
        className="w-full"
        style={{
          marginTop: 'var(--space-16)',
          maxWidth: '720px',
          background: 'var(--code-bg)',
          color: 'var(--code-text)',
          fontFamily: 'var(--font-mono)',
          fontSize: '14px',
          lineHeight: 1.6,
          padding: '20px 24px',
          borderRadius: 0,
          border: '1px solid #334155',
        }}
      >
        <div style={{ color: 'var(--code-comment)' }}>// render a PDF in one call</div>
        <div>
          <span style={{ color: 'var(--code-function)' }}>curl</span>{' '}
          <span style={{ color: 'var(--code-keyword)' }}>-X POST</span>{' '}
          <span style={{ color: 'var(--code-string)' }}>localhost:3000/v1/render</span>
        </div>
        <div>
          {'  '}<span style={{ color: 'var(--code-keyword)' }}>-H</span>{' '}
          <span style={{ color: 'var(--code-string)' }}>{'"Authorization: Bearer ts_..."'}</span>
        </div>
        <div>
          {'  '}<span style={{ color: 'var(--code-keyword)' }}>-d</span>{' '}
          <span style={{ color: 'var(--code-string)' }}>
            {"'{\"template\": \"<h1>{{name}}</h1>\", \"data\": {\"name\": \"World\"}}'"}
          </span>
        </div>
      </div>

      {/* Three pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full" style={{ maxWidth: '720px', marginTop: 'var(--space-12)' }}>
        {[
          { title: 'Render', desc: 'HTML or Typst templates to PDF. AI layout engine handles page breaks.', icon: '01' },
          { title: 'Verify', desc: 'OCR the output. Compare every field against the input. Store the score.', icon: '02' },
          { title: 'Extract', desc: 'Pull structured data from any document. Schema-driven, table-aware.', icon: '03' },
        ].map((item) => (
          <div
            key={item.title}
            style={{
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--muted)', marginBottom: 'var(--space-2)' }}>
              {item.icon}
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 'var(--space-1)' }}>
              {item.title}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.5 }}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
