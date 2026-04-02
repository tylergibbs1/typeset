'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ApiKey {
  id: string
  key_prefix: string
  name: string | null
  scopes: string[]
  tier: string
  rate_limit_rpm: number
  created_at: string
  revoked_at: string | null
}

interface Run {
  id: string
  status: string
  engine: string
  pages: number | null
  render_time_ms: number | null
  created_at: string
}

export function KeyManager({ orgId, keys, runs }: { orgId: string; keys: ApiKey[]; runs: Run[] }) {
  const [newKey, setNewKey] = useState<string | null>(null)
  const [keyName, setKeyName] = useState('')
  const [creating, setCreating] = useState(false)

  const createKey = async () => {
    setCreating(true)
    try {
      // Generate a random key
      const bytes = crypto.getRandomValues(new Uint8Array(24))
      const raw = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
      const fullKey = `ts_live_full_${raw}`

      // Hash it
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fullKey))
      const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

      const supabase = createClient()
      await supabase.from('api_keys').insert({
        key_hash: keyHash,
        key_prefix: 'ts_live_',
        org_id: orgId,
        name: keyName || 'Untitled Key',
        scopes: ['full'],
        tier: 'free',
        rate_limit_rpm: 10,
      })

      setNewKey(fullKey)
      setKeyName('')
    } finally {
      setCreating(false)
    }
  }

  const revokeKey = async (id: string) => {
    const supabase = createClient()
    await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    window.location.reload()
  }

  return (
    <div>
      {/* Create Key Section */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>API Keys</h2>

        {newKey && (
          <div style={{
            background: 'var(--success-soft)',
            border: '1px solid var(--success)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
            fontSize: '14px',
          }}>
            <p style={{ fontWeight: 600, marginBottom: '4px' }}>Key created. Copy it now — you won't see it again.</p>
            <code style={{
              fontFamily: 'var(--font-mono)',
              background: 'var(--white)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              wordBreak: 'break-all',
            }}>
              {newKey}
            </code>
          </div>
        )}

        <div className="flex gap-3" style={{ marginBottom: 'var(--space-4)' }}>
          <input
            type="text"
            placeholder="Key name (e.g. Production)"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--white)',
              color: 'var(--ink)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              fontSize: '14px',
            }}
          />
          <button
            onClick={createKey}
            disabled={creating}
            style={{
              background: 'var(--accent)',
              color: '#ffffff',
              fontWeight: 500,
              fontSize: '14px',
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: creating ? 'wait' : 'pointer',
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? 'Creating...' : 'Create Key'}
          </button>
        </div>

        {/* Keys Table */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'var(--paper-warm)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>Name</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>Key</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>Tier</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>Created</th>
                <th style={{ padding: '10px 16px', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>No API keys yet</td></tr>
              )}
              {keys.map((key) => (
                <tr key={key.id} style={{ borderTop: '1px solid var(--border)', opacity: key.revoked_at ? 0.5 : 1 }}>
                  <td style={{ padding: '10px 16px' }}>{key.name || 'Untitled'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--muted)' }}>
                      {key.key_prefix}{'••••••••'}
                    </code>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      background: 'var(--paper-warm)',
                      color: 'var(--ink-light)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                    }}>
                      {key.tier}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: '13px' }}>
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    {!key.revoked_at ? (
                      <button
                        onClick={() => revokeKey(key.id)}
                        style={{
                          background: 'transparent',
                          color: 'var(--error)',
                          border: 'none',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        Revoke
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>Revoked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Runs */}
      <section>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Recent Runs</h2>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'var(--paper-warm)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>Run</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>Engine</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>Pages</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>No runs yet. Render a document to see it here.</td></tr>
              )}
              {runs.map((run) => (
                <tr key={run.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{run.id}</code>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.05em',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      ...(run.status === 'completed' ? { background: 'var(--success-soft)', color: 'var(--success)' } :
                         run.status === 'failed' ? { background: 'var(--error-soft)', color: 'var(--error)' } :
                         run.status === 'rendering' ? { background: 'var(--accent-soft)', color: 'var(--accent)' } :
                         { background: 'var(--paper-warm)', color: 'var(--muted)' }),
                    }}>
                      {run.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      background: 'var(--paper-warm)',
                      color: 'var(--ink-light)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                    }}>
                      {run.engine}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{run.pages ?? '-'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{run.render_time_ms ? `${run.render_time_ms}ms` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
