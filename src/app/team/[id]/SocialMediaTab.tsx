'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help align-middle">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full flex-shrink-0 text-xs font-bold" style={{background:'#cec7bc',color:'#5c554e',lineHeight:1,fontSize:9}}>i</span>
      <span className="absolute left-0 top-full mt-1 z-50 px-2.5 py-2 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" style={{background:'#1a1512',color:'#f5f1eb',width:220,whiteSpace:'normal',lineHeight:1.5,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>{text}</span>
    </span>
  )
}

// Same formula-grounded text as CoachingStaff.tsx's STAT_TIPS — real
// mechanics, not marketing copy.
const STAT_TIPS_PT: Record<string, string> = {
  sm_engagement: 'Determina o crescimento (ou perda) passivo real de seguidores todas as semanas.',
  fan_interaction: 'Determina a chance semanal real de um evento de interação com fãs — sobe o moral de um jogador e os seguidores da equipa.',
  social_responsibility: 'Determina a chance semanal real de um evento de responsabilidade social — sobe a popularidade da equipa e a fama de um jogador.',
}
const STAT_TIPS_EN: Record<string, string> = {
  sm_engagement: 'Drives real passive follower growth (or loss) every week.',
  fan_interaction: 'Drives the real weekly chance of a fan-interaction event — raises one player\'s moral and the team\'s followers.',
  social_responsibility: 'Drives the real weekly chance of a social-responsibility event — raises team popularity and one player\'s fame.',
}

function StatBar({ label, value, color, tip }: { label: string, value: number, color: string, tip?: string }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-xs flex-shrink-0 flex items-center" style={{color:'#5c554e',width:110}}>{label}{tip && <Tooltip text={tip} />}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#cec7bc'}}>
        <div className="h-full rounded-full" style={{width:value+'%',background:color}}/>
      </div>
      <span className="text-xs font-bold w-6 text-right flex-shrink-0"
            style={{color:value>=85?'#b45309':value>=70?color:'#8a8279'}}>{value}</span>
    </div>
  )
}

const EVENT_INFO: Record<string, { icon: string, labelEN: string, labelPT: string, color: string }> = {
  fan_interaction:        { icon: '📸', labelEN: 'Fan Interaction Event',        labelPT: 'Evento de Interação com Fãs', color: '#1d4ed8' },
  social_responsibility:  { icon: '❤️', labelEN: 'Social Responsibility Event', labelPT: 'Evento de Responsabilidade Social', color: '#15803d' },
}

export default function SocialMediaTab({ teamId, teamColor, coaches, socialMediaFollowers }: {
  teamId: string, teamColor: string, coaches: any[], socialMediaFollowers?: number
}) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('social_media_events').select('*').eq('team_id', teamId).order('created_at', { ascending: false })
      setEvents(data || [])
      setLoading(false)
    })()
  }, [teamId])

  const manager = coaches.find((c: any) => c.role === 'social_media_manager')
  const initials = manager ? manager.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : ''

  if (loading) return <div className="text-center py-8" style={{ color: '#8a8279' }}>{t('common.loading')}</div>

  return (
    <div>
      <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: '#faf8f5', border: '1px solid #d4cdc5', color: '#5c554e', lineHeight: 1.6 }}>
        📱 {isPT
          ? 'O Social Media Manager gera atividade real: os seguidores oscilam consoante a qualidade dele/dela, e os eventos que promove afetam mesmo o jogo — moral de jogadores, popularidade do clube, fama e a mistura de público na arena. Tudo o que aconteceu fica registado aqui em baixo.'
          : "The Social Media Manager drives real activity: followers move with their quality, and the events they run genuinely affect the game — player morale, franchise popularity, fame, and the arena's audience mix. Everything that happened is logged below."}
      </div>

      <div className="rounded-xl p-4 mb-6" style={{ background: '#faf8f5', border: '1px solid #d4cdc5', borderTop: `3px solid ${teamColor}` }}>
        <div className="flex items-start gap-4 flex-wrap">
          {manager ? (
            <div className="flex items-start gap-3 flex-1 min-w-[220px]">
              <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center"
                   style={{ background: '#db2777' + '18', border: '2px solid #db277733' }}>
                {manager.photo_url ? <img src={manager.photo_url} alt={manager.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 16, fontWeight: 800, color: '#db2777' }}>{initials}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold mb-0.5" style={{ color: '#db2777' }}>{isPT ? 'Social Media Manager' : 'Social Media Manager'}</div>
                <div className="font-bold text-sm mb-2" style={{ color: '#1a1512' }}>{manager.name}</div>
                <StatBar label={isPT ? 'Envolvimento' : 'SM Engagement'} value={manager.sm_engagement} color="#db2777" tip={isPT ? STAT_TIPS_PT.sm_engagement : STAT_TIPS_EN.sm_engagement} />
                <StatBar label={isPT ? 'Interação c/ Fãs' : 'Fan Interaction'} value={manager.fan_interaction} color="#1d4ed8" tip={isPT ? STAT_TIPS_PT.fan_interaction : STAT_TIPS_EN.fan_interaction} />
                <StatBar label={isPT ? 'Resp. Social' : 'Social Resp.'} value={manager.social_responsibility} color="#15803d" tip={isPT ? STAT_TIPS_PT.social_responsibility : STAT_TIPS_EN.social_responsibility} />
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm" style={{ color: '#8a8279' }}>{isPT ? 'Sem Social Media Manager contratado.' : 'No Social Media Manager hired.'}</p>
            </div>
          )}
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-black" style={{ color: '#db2777' }}>{Number(socialMediaFollowers || 0).toLocaleString()}</div>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8a8279' }}>{isPT ? 'seguidores' : 'followers'}</div>
          </div>
        </div>
      </div>

      <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#8a8279' }}>
        {isPT ? 'Histórico de Ações' : 'Action History'}
      </h2>
      {events.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: '#e8e2d6', border: '1px solid #d4cdc5' }}>
          <p className="text-sm" style={{ color: '#6b5f4e' }}>
            {isPT ? 'O primeiro evento aparece quando o Social Media Manager realizar a sua primeira ação.' : "The first event appears once your Social Media Manager runs their first action."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: '#e8e2d6', border: '1px solid #d4cdc5' }}>
          {events.map((e: any, i: number) => {
            const info = EVENT_INFO[e.event_type] || { icon: '📱', labelEN: e.event_type, labelPT: e.event_type, color: '#5c554e' }
            const impact = e.impact_summary || {}
            const impactParts: string[] = []
            if (impact.moraleBump) impactParts.push(`${e.player_name}: +${impact.moraleBump} ${isPT ? 'moral' : 'morale'}`)
            if (impact.fameBump) impactParts.push(`${e.player_name}: +${impact.fameBump} ${isPT ? 'fama' : 'fame'}`)
            if (impact.popularityBump) impactParts.push(`+${impact.popularityBump} ${isPT ? 'popularidade' : 'popularity'}`)
            if (impact.loyalFanBump) impactParts.push(`+${(impact.loyalFanBump * 100).toFixed(1)}% ${isPT ? 'fãs fiéis' : 'loyal fans'}`)
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2.5" style={{ background: i % 2 === 0 ? '#ece7dd' : '#e8e2d6', borderBottom: '1px solid #d4cdc5' }}>
                <span className="text-lg flex-shrink-0">{info.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: info.color }}>{isPT ? info.labelPT : info.labelEN}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#8a8279' }}>
                    {isPT ? 'Semana' : 'Week'} {e.week_number}{impactParts.length ? ` · ${impactParts.join(' · ')}` : ''}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-black" style={{ color: '#db2777' }}>+{e.follower_delta.toLocaleString()}</div>
                  <div className="text-xs" style={{ color: '#8a8279' }}>{e.followers_after.toLocaleString()} {isPT ? 'total' : 'total'}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
