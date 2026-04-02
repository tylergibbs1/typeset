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
    <main className="max-w-4xl mx-auto px-4" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)' }}>
      <KeyManager orgId={org!.id} keys={keys || []} runs={runs || []} />
    </main>
  )
}
