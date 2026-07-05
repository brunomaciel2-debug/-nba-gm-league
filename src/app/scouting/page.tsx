'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

// The real scouting UI already lives on the team page's "scouting" tab
// (ScoutingTab.tsx) — this route exists only because several buttons across
// the app link to a standalone /scouting URL. Redirect to the GM's own
// team's scouting tab instead of duplicating that UI here.
export default function ScoutingRedirectPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const router = useRouter()
  const [error, setError] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError(true); return }
      const { data: gm } = await supabase.from('gm_profiles').select('team_id').eq('id', user.id).single()
      if (!gm?.team_id) { setError(true); return }
      router.replace(`/team/${gm.team_id}?tab=scouting`)
    })()
  }, [router])

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-sm" style={{ color: '#8a8279' }}>
          {isPT ? 'Precisas de estar associado a uma equipa para ver o scouting.' : 'You need to be assigned to a team to view scouting.'}
        </p>
      </div>
    )
  }
  return <div className="max-w-lg mx-auto px-4 py-12 text-center" style={{ color: '#8a8279' }}>{t('common.loading')}</div>
}
