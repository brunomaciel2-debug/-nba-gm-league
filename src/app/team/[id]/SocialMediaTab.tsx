'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

function StatBar({ label, value, color }: { label: string, value: number, color: string }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-xs flex-shrink-0" style={{color:'#5c554e',width:110}}>{label}</span>
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
                <StatBar label={isPT ? 'Envolvimento' : 'SM Engagement'} value={manager.sm_engagement} color="#db2777" />
                <StatBar label={isPT ? 'Interação c/ Fãs' : 'Fan Interaction'} value={manager.fan_interaction} color="#1d4ed8" />
                <StatBar label={isPT ? 'Resp. Social' : 'Social Resp.'} value={manager.social_responsibility} color="#15803d" />
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
