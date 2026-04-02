import Link from 'next/link'

export function DashboardNav({ user }: { user: { email?: string; avatar_url?: string; user_name?: string } | null }) {
  return (
    <nav
      style={{
        height: 56,
        borderBottom: '1px solid var(--border)',
        background: 'var(--white)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-6)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              fontSize: '15px',
              color: 'var(--ink)',
            }}
          >
            typeset
          </span>
        </Link>

        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: '14px' }}>
          <Link
            href="/docs"
            style={{
              color: 'var(--muted)',
              textDecoration: 'none',
              transition: 'color var(--duration-normal)',
            }}
          >
            Docs
          </Link>
          <Link
            href="/dashboard"
            style={{
              color: 'var(--ink)',
              textDecoration: 'none',
              fontWeight: 500,
              borderBottom: '2px solid var(--accent)',
              paddingBottom: 2,
            }}
          >
            Dashboard
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {user ? (
          <>
            {user.avatar_url && (
              <img
                src={user.avatar_url}
                alt=""
                width={28}
                height={28}
                style={{ borderRadius: 'var(--radius-full)' }}
              />
            )}
            <span style={{ fontSize: '14px', color: 'var(--muted)' }}>
              {user.user_name || user.email}
            </span>
            <form action="/auth/signout" method="POST" style={{ margin: 0 }}>
              <button
                type="submit"
                style={{
                  background: 'transparent',
                  color: 'var(--muted)',
                  border: '1px solid var(--border)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  marginLeft: 'var(--space-2)',
                }}
              >
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/login"
            style={{
              background: 'var(--accent)',
              color: '#ffffff',
              fontWeight: 500,
              fontSize: '13px',
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
            }}
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  )
}
