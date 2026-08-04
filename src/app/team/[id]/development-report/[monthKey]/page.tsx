'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'
import { getWeekForDate, getWeekDates } from '@/lib/season-week-helper'

// Same abbreviations already used in TrainingTab.tsx — kept in sync by hand
// (that file doesn't export these), same convention as its own
// SLOT_CONFIG_EN/PT being defined locally instead of shared.
const ATTR_LABEL: Record<string,string> = {
  three:'3PT', layup:'Layup', dunk:'Dunk', mid:'Mid', ft:'FT', siq:'SIQ', draw_foul:'DF',
  blk:'BLK', stl:'STL', idef:'IDEF', pdef:'PDEF',
  stamina:'STA', durability:'DUR', def_reb:'DREB', off_reb:'OREB',
  ball_hdl:'BH', pass_vis:'PV', pass_iq:'PIQ', assist_role:'AR',
  pressure:'CLU', consistency:'CON', crowd_effect:'CE', streaky:'STR',
}
// Fixed column order (offense, defense, physical, playmaking, mental) so the
// table reads the same way every month instead of shuffling by whichever
// attribute happened to change first.
const ATTR_ORDER = [
  'three','layup','dunk','mid','ft','siq','draw_foul',
  'blk','stl','idef','pdef',
  'stamina','durability','def_reb','off_reb',
  'ball_hdl','pass_vis','pass_iq','assist_role',
  'pressure','consistency','crowd_effect','streaky',
]

const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function DevelopmentReportPage({ params }: { params: { id: string, monthKey: string } }) {
  const teamId = params.id.toUpperCase()
  const monthKey = params.monthKey // 'YYYY-MM'
  const { profile } = useAuth()
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<any>(null)
  // playerId -> attribute -> net change this month
  const [changes, setChanges] = useState<Record<number, Record<string, number>>>({})
  const [playerNames, setPlayerNames] = useState<Record<number,string>>({})

  useEffect(() => {
    supabase.from('teams').select('id,name,primary_color').eq('id',teamId).single().then(({data})=>data&&setTeam(data))

    const [yearStr, monthStr] = monthKey.split('-')
    const year = Number(yearStr), month = Number(monthStr) - 1 // 0-indexed like Date

    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const firstWeek = getWeekForDate(ymd(new Date(year, month, 1)))
    const lastWeek = getWeekForDate(ymd(new Date(year, month+1, 0)))
    // A week counts toward whichever month contains that week's own FIRST
    // day — matches exactly the rule the notification sweep in run.ts uses,
    // so this report always reflects precisely the month the GM was told.
    const devWeeks: number[] = []
    for (let w = Math.max(1, firstWeek); w <= lastWeek; w++) {
      const wStart = getWeekDates(w).start
      if (wStart.getFullYear() === year && wStart.getMonth() === month) devWeeks.push(w)
    }

    supabase.from('players').select('id,name').eq('team_id', teamId).then(async ({ data: roster }) => {
      const rosterIds = (roster||[]).map((p:any)=>p.id)
      if (!rosterIds.length || !devWeeks.length) { setLoading(false); return }
      const names: Record<number,string> = {}
      ;(roster||[]).forEach((p:any)=>{ names[p.id] = p.name })
      setPlayerNames(names)

      const { data: devRows } = await supabase.from('attribute_development')
        .select('player_id,attribute,change').in('player_id', rosterIds).in('week_number', devWeeks)

      const byPlayer: Record<number, Record<string, number>> = {}
      ;(devRows||[]).forEach((r:any) => {
        const p = (byPlayer[r.player_id] ||= {})
        p[r.attribute] = (p[r.attribute] || 0) + (r.change || 0)
      })
      setChanges(byPlayer)
      setLoading(false)
    })
  }, [teamId, monthKey])

  if (!isGM) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-2xl p-16 text-center" style={{ background: '#faf8f5', border: '1px solid #d4cdc5' }}>
          <div className="text-5xl mb-4">🔒</div>
          <h3 className="text-lg font-black mb-2" style={{ color: '#1a1512' }}>{isPT ? 'Informação Privada' : 'Private Information'}</h3>
          <p className="text-sm" style={{ color: '#8a8279' }}>
            {isPT ? 'O relatório de desenvolvimento de uma equipa só é visível ao seu GM e ao Comissário.' : "A team's development report is only visible to its own GM and the Commissioner."}
          </p>
        </div>
      </div>
    )
  }
  if (loading) return <div className="text-center py-12" style={{ color: '#8a8279' }}>{t('common.loading')}</div>

  const [yearStr, monthStr] = monthKey.split('-')
  const monthIdx = Number(monthStr) - 1
  const monthLabel = `${isPT ? MONTH_NAMES_PT[monthIdx] : MONTH_NAMES_EN[monthIdx]} ${yearStr}`

  // Only players with at least one nonzero change this month, and only
  // attributes that changed for at least one of them — a full 15x23 grid
  // of mostly dashes would bury the handful of real moves in noise.
  const playersWithChanges = Object.entries(changes)
    .filter(([, attrs]) => Object.values(attrs).some(v => v !== 0))
    .map(([pid]) => Number(pid))
    .sort((a,b) => (playerNames[a]||'').localeCompare(playerNames[b]||''))
  const attrsWithChanges = ATTR_ORDER.filter(attr =>
    playersWithChanges.some(pid => (changes[pid]?.[attr] || 0) !== 0))

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href={`/team/${teamId}#roster`} className="text-xs font-semibold" style={{ color: '#8a8279', textDecoration: 'none' }}>
        {isPT ? '← Voltar à equipa' : '← Back to team'}
      </Link>
      <h1 className="text-2xl font-black mt-2 mb-1" style={{ color: '#1a1512' }}>
        📈 {isPT ? 'Relatório de Desenvolvimento' : 'Development Report'}
      </h1>
      <p className="text-sm mb-6" style={{ color: '#8a8279' }}>
        {team?.name || teamId} · {monthLabel}
      </p>

      {playersWithChanges.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#faf8f5', border: '1px solid #d4cdc5' }}>
          <p className="text-sm" style={{ color: '#8a8279' }}>
            {isPT ? 'Nenhuma evolução de atributos registada este mês.' : 'No attribute changes recorded this month.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid #d4cdc5' }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f0ece5' }}>
                <th className="text-left px-4 py-2 font-bold" style={{ color: '#5c554e' }}>
                  {isPT ? 'Jogador' : 'Player'}
                </th>
                {attrsWithChanges.map(attr => (
                  <th key={attr} className="text-center px-3 py-2 font-bold" style={{ color: '#5c554e' }}>
                    {ATTR_LABEL[attr] || attr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {playersWithChanges.map((pid, idx) => (
                <tr key={pid} style={{ borderTop: idx > 0 ? '1px solid #e2dcd5' : undefined }}>
                  <td className="px-4 py-2 font-semibold" style={{ color: '#1a1512' }}>
                    <Link href={`/player/${pid}`} style={{ color: '#1a1512', textDecoration: 'none' }}>
                      {playerNames[pid] || `#${pid}`}
                    </Link>
                  </td>
                  {attrsWithChanges.map(attr => {
                    const v = changes[pid]?.[attr] || 0
                    return (
                      <td key={attr} className="text-center px-3 py-2 font-bold"
                        style={{ color: v > 0 ? '#15803d' : v < 0 ? '#dc2626' : '#c8c0b8' }}>
                        {v === 0 ? '—' : `${v > 0 ? '+' : ''}${v}`}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
