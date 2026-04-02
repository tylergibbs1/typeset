import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KeyManager } from './key-manager'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check if user has an org, create one if not
  let { data: org } = await supabase
    .from('organizations')
    .select('*')
    .limit(1)
    .single()

  if (!org) {
    const { data: newOrg } = await supabase
      .from('organizations')
      .insert({ name: user.user_metadata.user_name || user.email || 'My Organization' })
      .select()
      .single()
    org = newOrg
  }

  // Fetch API keys for this org
  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, key_prefix, name, scopes, tier, rate_limit_rpm, created_at, revoked_at')
    .eq('org_id', org!.id)
    .order('created_at', { ascending: false })

  // Fetch recent runs
  const { data: runs } = await supabase
    .from('runs')
    .select('id, status, engine, pages, render_time_ms, created_at')
    .eq('org_id', org!.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <main className="max-w-4xl mx-auto px-4" style={{ paddingTop: 'var(--space-12)', paddingBottom: 'var(--space-12)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="flex items-center gap-4">
          {user.user_metadata.avatar_url && (
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              width={40}
              height={40}
              style={{ borderRadius: 'var(--radius-full)' }}
            />
          )}
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Dashboard</h1>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              {user.user_metadata.user_name || user.email}
            </p>
          </div>
        </div>
        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            style={{
              background: 'transparent',
              color: 'var(--muted)',
              border: '1px solid var(--border)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </form>
      </div>

      <KeyManager orgId={org!.id} keys={keys || []} runs={runs || []} />
    </main>
  )
}
