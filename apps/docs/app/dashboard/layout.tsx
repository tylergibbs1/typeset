import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DashboardNav } from '@/components/dashboard-nav'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <DashboardNav
        user={user ? {
          email: user.email,
          avatar_url: user.user_metadata?.avatar_url,
          user_name: user.user_metadata?.user_name,
        } : null}
      />
      {children}
    </>
  )
}
