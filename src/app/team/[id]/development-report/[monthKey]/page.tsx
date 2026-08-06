'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'
import { getWeekForDate, getWeekDates } from '@/lib/season-week-helper'

// Same abbreviations already used in TrainingTab.tsx/RosterTable.tsx — kept
// in sync by hand (those files don't export these), same convention as
// their own SLOT_CONFIG_EN/PT being defined locally instead of shared.
const ATTR_LABEL: Record<string,string> = {
  three:'3PT', layup:'Layup', dunk:'Dunk', mid:'Mid', ft:'FT', siq:'SIQ', draw_foul:'DF',
  blk:'BLK', stl:'STL', idef:'IDEF', pdef:'PDEF',
  stamina:'STA', durability:'DUR', def_reb:'DREB', off_reb:'OREB',
  ball_hdl:'BH', pass_vis:'PV', pass_iq:'PIQ', assist_role:'AR',
  pressure:'CLU', consistency:'CON', crowd_effect:'CE', streaky:'STR',
}
// Full names for the hover tooltip — same wording RosterTable.tsx already
// uses for these attributes (minus its "(0-100)" suffix, meaningless here
// since this page shows a net change, not an absolute value).
const ATTR_FULL_PT: Record<string,string> = {
  three:'Lançamento de 3 Pontos', layup:'Layup', dunk:'Dunk', mid:'Meia Distância',
  ft:'Lances Livres', siq:'Shot IQ', draw_foul:'Provoca Falta',
  blk:'Desarme de Lançamento', stl:'Roubo de Bola', idef:'Defesa Interior', pdef:'Defesa de Perímetro',
  stamina:'Resistência/Stamina', durability:'Durabilidade', def_reb:'Ressalto Defensivo', off_reb:'Ressalto Ofensivo',
  ball_hdl:'Drible', pass_vis:'Visão de Jogo', pass_iq:'Pass IQ', assist_role:'Perfil de Assistência',
  pressure:'Clutch/Pressão', consistency:'Consistência', crowd_effect:'Influência do Público', streaky:'Irregular',
}
const ATTR_FULL_EN: Record<string,string> = {
  three:'Three-Point Shooting', layup:'Layup', dunk:'Dunk', mid:'Mid-Range',
  ft:'Free Throw', siq:'Shot IQ', draw_foul:'Draw Foul',
  blk:'Block', stl:'Steal', idef:'Interior Defense', pdef:'Perimeter Defense',
  stamina:'Stamina', durability:'Durability', def_reb:'Defensive Rebound', off_reb:'Offensive Rebound',
  ball_hdl:'Ball Handle', pass_vis:'Pass Vision', pass_iq:'Pass IQ', assist_role:'Assist Role',
  pressure:'Clutch', consistency:'Consistency', crowd_effect:'Crowd Effect', streaky:'Streaky',
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
// Category grouping — shown as a color-coded acronym + a one-time legend
// above the table (not a solid header bar, which reads too heavy against
// this app's muted palette), so 23 columns still cluster into 5 intuitive
// groups without a jarring colored block.
const ATTR_CATEGORY: Record<string,string> = {
  three:'off', layup:'off', dunk:'off', mid:'off', ft:'off', siq:'off', draw_foul:'off',
  blk:'def', stl:'def', idef:'def', pdef:'def',
  stamina:'phys', durability:'phys', def_reb:'phys', off_reb:'phys',
  ball_hdl:'play', pass_vis:'play', pass_iq:'play', assist_role:'play',
  pressure:'ment', consistency:'ment', crowd_effect:'ment', streaky:'ment',
}
const CATEGORY_LABEL_PT: Record<string,string> = { off:'Ofensiva', def:'Defesa', phys:'Físico', play:'Passe', ment:'Mental' }
const CATEGORY_LABEL_EN: Record<string,string> = { off:'Offense', def:'Defense', phys:'Physical', play:'Playmaking', ment:'Mental' }
const CATEGORY_COLOR: Record<string,string> = { off:'#c2410c', def:'#dc2626', phys:'#166534', play:'#0e7490', ment:'#b45309' }
const CATEGORY_ORDER = ['off','def','phys','play','ment']

const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// Same hover-tooltip pattern as RosterTable.tsx's TH component (small "i"
// badge + dark box on hover) — reused here so this page feels native to
// the app instead of relying on the barely-visible native browser tooltip.
function AttrHeader({ attr, isPT, isGroupStart }: { attr: string, isPT: boolean, isGroupStart: boolean }) {
  const cat = ATTR_CATEGORY[attr]
  return (
    <th className="text-center px-3 py-2 font-bold"
      style={{ borderLeft: isGroupStart ? '1px solid #d4cdc5' : undefined }}>
      <span className="inline-flex items-center gap-0.5 group relative cursor-help">
        <span style={{ color: CATEGORY_COLOR[cat] }}>{ATTR_LABEL[attr] || attr}</span>
        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full ml-0.5 flex-shrink-0"
          style={{ background: '#d4cdc5', color: '#1e40af', fontSize: 8, lineHeight: 1 }}>i</span>
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2.5 py-1.5 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
          style={{ background: '#1a1512', color: '#f5f1eb', width: 150, whiteSpace: 'normal', lineHeight: 1.5, fontWeight: 400 }}>
          {isPT ? ATTR_FULL_PT[attr] : ATTR_FULL_EN[attr]}
        </span>
      </span>
    </th>
  )
}

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
  const [playerInfo, setPlayerInfo] = useState<Record<number,{ name: string, photo_url: string | null }>>({})

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

    supabase.from('players').select('id,name,photo_url').eq('team_id', teamId).then(async ({ data: roster }) => {
      const rosterIds = (roster||[]).map((p:any)=>p.id)
      if (!rosterIds.length || !devWeeks.length) { setLoading(false); return }
      const info: Record<number,{ name: string, photo_url: string | null }> = {}
      ;(roster||[]).forEach((p:any)=>{ info[p.id] = { name: p.name, photo_url: p.photo_url || null } })
      setPlayerInfo(info)

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
    .sort((a,b) => (playerInfo[a]?.name||'').localeCompare(playerInfo[b]?.name||''))
  const attrsWithChanges = ATTR_ORDER.filter(attr =>
    playersWithChanges.some(pid => (changes[pid]?.[attr] || 0) !== 0))
  const categoriesPresent = CATEGORY_ORDER.filter(cat => attrsWithChanges.some(a => ATTR_CATEGORY[a] === cat))

  const totalByPlayer: Record<number, number> = {}
  playersWithChanges.forEach(pid => {
    totalByPlayer[pid] = Object.values(changes[pid] || {}).reduce((s, v) => s + v, 0)
  })

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
        <>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3">
          {categoriesPresent.map(cat => (
            <span key={cat} className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#5c554e' }}>
              <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: CATEGORY_COLOR[cat] }} />
              {isPT ? CATEGORY_LABEL_PT[cat] : CATEGORY_LABEL_EN[cat]}
            </span>
          ))}
        </div>
        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid #d4cdc5' }}>
          <table className="text-sm" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ background: '#f0ece5' }}>
                <th className="text-left px-4 py-2 font-bold"
                  style={{ color: '#5c554e', background: '#f0ece5', position: 'sticky', left: 0, zIndex: 1 }}>
                  {isPT ? 'Jogador' : 'Player'}
                </th>
                {attrsWithChanges.map((attr, i) => (
                  <AttrHeader key={attr} attr={attr} isPT={isPT}
                    isGroupStart={i > 0 && ATTR_CATEGORY[attrsWithChanges[i - 1]] !== ATTR_CATEGORY[attr]} />
                ))}
                <th className="text-center px-3 py-2 font-bold" style={{ color: '#5c554e' }}>
                  {isPT ? 'Total' : 'Total'}
                </th>
              </tr>
            </thead>
            <tbody>
              {playersWithChanges.map((pid, idx) => {
                const total = totalByPlayer[pid] || 0
                const p = playerInfo[pid]
                const rowBg = idx % 2 === 1 ? '#faf8f5' : '#fff'
                return (
                <tr key={pid} className="transition-colors hover:bg-[#f5f1ea]" style={{ background: rowBg, borderTop: '1px solid #e2dcd5' }}>
                  <td className="px-4 py-2 font-semibold" style={{ color: '#1a1512', position: 'sticky', left: 0, zIndex: 1, background: rowBg }}>
                    <Link href={`/player/${pid}`} className="flex items-center gap-2" style={{ color: '#1a1512', textDecoration: 'none' }}>
                      <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 inline-flex items-center justify-center" style={{ background: (team?.primary_color || '#8a8279') + '22' }}>
                        {p?.photo_url
                          ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                          : <span className="text-[10px] font-black" style={{ color: team?.primary_color || '#8a8279' }}>
                              {(p?.name || '').split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                            </span>}
                      </span>
                      {p?.name || `#${pid}`}
                    </Link>
                  </td>
                  {attrsWithChanges.map((attr, i) => {
                    const v = changes[pid]?.[attr] || 0
                    const isGroupStart = i > 0 && ATTR_CATEGORY[attrsWithChanges[i - 1]] !== ATTR_CATEGORY[attr]
                    return (
                      <td key={attr} className="text-center px-3 py-2"
                        style={{ borderLeft: isGroupStart ? '1px solid #e2dcd5' : undefined }}>
                        {v === 0 ? (
                          <span style={{ color: '#c8c0b8' }}>—</span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-0.5 rounded-md font-bold"
                            style={{
                              minWidth: 32, padding: '2px 6px',
                              color: v > 0 ? '#15803d' : '#dc2626',
                              background: v > 0 ? '#dcfce7' : '#fee2e2',
                            }}>
                            <span style={{ fontSize: 9 }}>{v > 0 ? '▲' : '▼'}</span>{Math.abs(v)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                  <td className="text-center px-3 py-2 font-black" style={{ color: total > 0 ? '#15803d' : total < 0 ? '#dc2626' : '#8a8279' }}>
                    {total === 0 ? '—' : `${total > 0 ? '+' : ''}${total}`}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
