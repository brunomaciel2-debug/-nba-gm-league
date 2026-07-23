'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'
import { formatSimMonthName } from '@/lib/season-week-helper'

const STAT_CONFIG = [
  { key: 'pts', per: 'ppg', labelEn: 'PPG', labelPt: 'PPG', icon: '🏀' },
  { key: 'reb', per: 'rpg', labelEn: 'RPG', labelPt: 'RPG', icon: '🔄' },
  { key: 'ast', per: 'apg', labelEn: 'APG', labelPt: 'APG', icon: '🎯' },
  { key: 'stl', per: 'spg', labelEn: 'SPG', labelPt: 'SPG', icon: '🖐️' },
  { key: 'blk', per: 'bpg', labelEn: 'BPG', labelPt: 'BPG', icon: '🚫' },
] as const

const TIER_ORDER = ['jersey', 'court', 'panels'] as const
const TIER_META: Record<string, { icon: string, labelEn: string, labelPt: string, color: string }> = {
  jersey: { icon: '👕', labelEn: 'Jersey', labelPt: 'Camisola', color: '#1d4ed8' },
  court:  { icon: '🏀', labelEn: 'Court',  labelPt: 'Campo',    color: '#b45309' },
  panels: { icon: '📺', labelEn: 'Panels', labelPt: 'Painéis',  color: '#15803d' },
}

function fmtMoney(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return sign + '$' + (abs/1_000_000).toFixed(1) + 'M'
  if (abs >= 1_000) return sign + '$' + (abs/1_000).toFixed(0) + 'K'
  return sign + '$' + abs.toFixed(0)
}

function Card({ title, icon, children }: { title: string, icon: string, children: React.ReactNode }) {
  return (
    <div style={{background:'#faf8f5', border:'1px solid #d4cdc5', borderRadius:14, padding:16}}>
      <div style={{fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'#8a8279', marginBottom:12, display:'flex', alignItems:'center', gap:6}}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  )
}

export default function OverviewTab({ teamId, teamColor, players, games }: {
  teamId: string, teamColor: string, players: any[], games: any[]
}) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<any>(null)
  const [confTeams, setConfTeams] = useState<any[]>([])
  const [capacity, setCapacity] = useState<number>(0)
  const [gm, setGm] = useState<any>(null)
  const [sponsorNames, setSponsorNames] = useState<Partial<Record<string,string>>>({})
  const [finance, setFinance] = useState<{ revenue: number, expense: number, monthNum: number } | null>(null)

  useEffect(() => {
    (async () => {
      const [
        { data: teamRow }, { data: allTeams }, { data: sections }, { data: gmRow },
        { data: contracts }, { data: pool }, { data: jerseys },
        { data: cfg },
      ] = await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase.from('teams').select('id,conference,division,wins,losses,pts_for,pts_against').not('id','in','(ALL,RVS,ROO,SOP)'),
        supabase.from('arena_sections').select('capacity').eq('team_id', teamId),
        supabase.from('gm_profiles').select('display_name,photo_url').eq('team_id', teamId).eq('role','gm').maybeSingle(),
        supabase.from('sponsor_contracts').select('tier,template_id').eq('team_id', teamId).eq('season','2025-26').eq('status','active'),
        supabase.from('sponsor_pool').select('tier,template_id').eq('team_id', teamId).eq('season','2025-26'),
        supabase.from('sponsor_jersey_images').select('option_number,tier,company_name').eq('team_id', teamId).eq('season','2025-26'),
        supabase.from('season_config').select('current_week').eq('id', 1).single(),
      ])

      setTeam(teamRow)
      setConfTeams(allTeams || [])
      setCapacity((sections || []).reduce((s: number, r: any) => s + (r.capacity || 0), 0))
      setGm(gmRow)

      const names: Partial<Record<string,string>> = {}
      ;(contracts || []).forEach((c: any) => {
        const tierPool = (pool || []).filter((p: any) => p.tier === c.tier)
        const idx = tierPool.findIndex((p: any) => p.template_id === c.template_id)
        const img = idx >= 0 ? (jerseys || []).find((j: any) => j.option_number === idx + 1 && j.tier === c.tier) : undefined
        if (img?.company_name) names[c.tier] = img.company_name
      })
      setSponsorNames(names)

      const week = (cfg as any)?.current_week || 0
      const monthNum = Math.max(1, Math.floor(week / 4))
      const monthStartWeek = (monthNum - 1) * 4 + 1
      const monthEndWeek = monthNum * 4
      const { data: txns } = await supabase.from('franchise_transactions')
        .select('type,amount,week_number').eq('team_id', teamId).eq('season','2025-26')
        .gte('week_number', monthStartWeek).lte('week_number', monthEndWeek)
      const revenue = (txns || []).filter((x: any) => x.type === 'revenue').reduce((s: number, x: any) => s + x.amount, 0)
      const expense = (txns || []).filter((x: any) => x.type === 'expense').reduce((s: number, x: any) => s + x.amount, 0)
      setFinance({ revenue, expense, monthNum })

      setLoading(false)
    })()
  }, [teamId])

  if (loading || !team) return <div style={{color:'#8a8279',padding:20}}>{t('common.loading')}</div>

  const played = games.filter((g: any) => g.status === 'final' && g.game_type === 'regular')
  const wins = played.filter((g: any) => (g.home_team===teamId ? g.home_score : g.away_score) > (g.home_team===teamId ? g.away_score : g.home_score)).length
  const losses = played.length - wins
  const pct = played.length > 0 ? (wins/played.length).toFixed(3).replace(/^0/, '') : '.000'

  const last10 = played.slice(-10)
  const last10Record = last10.reduce((acc: {w:number,l:number}, g: any) => {
    const won = (g.home_team===teamId ? g.home_score : g.away_score) > (g.home_team===teamId ? g.away_score : g.home_score)
    return won ? { w: acc.w+1, l: acc.l } : { w: acc.w, l: acc.l+1 }
  }, { w: 0, l: 0 })

  const rankIn = (list: any[]) => {
    const sorted = [...list].sort((a,b) => b.wins-a.wins || (b.pts_for-b.pts_against)-(a.pts_for-a.pts_against))
    return sorted.findIndex(x => x.id === teamId) + 1
  }
  const confRank = rankIn(confTeams.filter((x:any) => x.conference === team.conference))
  const divRank = rankIn(confTeams.filter((x:any) => x.division === team.division))

  const leaders = STAT_CONFIG.map(cfg => {
    let best: any = null, bestVal = -1
    for (const p of players) {
      const stat = Array.isArray(p.player_stats) ? p.player_stats[0] : p.player_stats
      const gp = stat?.games || 0
      if (gp <= 0) continue
      const val = (stat[cfg.key] || 0) / gp
      if (val > bestVal) { bestVal = val; best = p }
    }
    return { ...cfg, player: best, value: bestVal }
  })

  const netFinance = (finance?.revenue || 0) - (finance?.expense || 0)
  const maxBar = Math.max(finance?.revenue || 0, finance?.expense || 0, 1)
  const monthName = finance ? formatSimMonthName(finance.monthNum, isPT ? 'pt-PT' : 'en-US') : ''

  return (
    <div>
      {/* HERO: arena banner */}
      <div style={{
        position:'relative', height:200, borderRadius:16, overflow:'hidden', marginBottom:16,
        background: team.arena_photo_url ? `url(${team.arena_photo_url}) center/cover` : `linear-gradient(135deg, ${teamColor}, #1a1512)`,
      }}>
        <div style={{position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.15))'}}/>
        <div style={{position:'absolute', bottom:16, left:20, right:20, color:'#fff'}}>
          <div style={{fontSize:11, opacity:0.85, fontWeight:600, textTransform:'uppercase', letterSpacing:1}}>{isPT ? 'Pavilhão' : 'Arena'}</div>
          <div style={{fontSize:24, fontWeight:900}}>{team.arena || '—'}</div>
          {capacity > 0 && <div style={{fontSize:13, opacity:0.9, marginTop:2}}>🎟️ {capacity.toLocaleString()} {isPT ? 'lugares' : 'seats'}</div>}
        </div>
      </div>

      {/* QUICK STATS ROW */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16}}>
        <div style={{background:'#faf8f5', border:'1px solid #d4cdc5', borderTop:`3px solid ${teamColor}`, borderRadius:10, padding:12, textAlign:'center'}}>
          <div style={{fontSize:20, fontWeight:900, color:'#1a1512'}}>{wins}-{losses}</div>
          <div style={{fontSize:10, color:'#8a8279'}}>{pct} {isPT ? 'PCT' : 'PCT'}</div>
        </div>
        <div style={{background:'#faf8f5', border:'1px solid #d4cdc5', borderTop:`3px solid ${teamColor}`, borderRadius:10, padding:12, textAlign:'center'}}>
          <div style={{fontSize:20, fontWeight:900, color:'#1a1512'}}>#{confRank || '—'}</div>
          <div style={{fontSize:10, color:'#8a8279'}}>{team.conference}</div>
        </div>
        <div style={{background:'#faf8f5', border:'1px solid #d4cdc5', borderTop:`3px solid ${teamColor}`, borderRadius:10, padding:12, textAlign:'center'}}>
          <div style={{fontSize:20, fontWeight:900, color:'#1a1512'}}>#{divRank || '—'}</div>
          <div style={{fontSize:10, color:'#8a8279'}}>{team.division}</div>
        </div>
        <div style={{background:'#faf8f5', border:'1px solid #d4cdc5', borderTop:`3px solid ${teamColor}`, borderRadius:10, padding:12, textAlign:'center'}}>
          <div style={{display:'flex', gap:3, justifyContent:'center', marginBottom:4}}>
            {last10.map((g: any, i: number) => {
              const won = (g.home_team===teamId ? g.home_score : g.away_score) > (g.home_team===teamId ? g.away_score : g.home_score)
              return <span key={i} style={{width:8, height:8, borderRadius:'50%', background: won ? '#15803d' : '#dc2626'}}/>
            })}
          </div>
          <div style={{fontSize:10, color:'#8a8279'}}>{isPT ? 'Últimos' : 'Last'} {last10.length} ({last10Record.w}-{last10Record.l})</div>
        </div>
      </div>

      {/* TWO COLUMNS */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          <Card title="General Manager" icon="🧑‍💼">
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              <div style={{width:52, height:52, borderRadius:'50%', flexShrink:0, overflow:'hidden', background: teamColor+'22', border:`2px solid ${teamColor}44`, display:'flex', alignItems:'center', justifyContent:'center'}}>
                {gm?.photo_url
                  ? <img src={gm.photo_url} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                  : <span style={{fontSize:16, fontWeight:900, color:teamColor}}>{(gm?.display_name || '?').split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</span>}
              </div>
              <div>
                <div style={{fontSize:15, fontWeight:800, color:'#1a1512'}}>{gm?.display_name || (isPT ? 'Sem GM' : 'No GM')}</div>
                <div style={{fontSize:11, color:'#8a8279'}}>General Manager</div>
              </div>
            </div>
          </Card>

          <Card title={isPT ? 'Patrocinadores' : 'Sponsors'} icon="💰">
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {TIER_ORDER.map(tier => {
                const meta = TIER_META[tier]
                const name = sponsorNames[tier]
                return (
                  <div key={tier} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, background: name ? meta.color+'11' : '#f0ece5', border:`1px solid ${name ? meta.color+'33' : '#e2dcd5'}`}}>
                    <span style={{fontSize:16}}>{meta.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10, color:'#8a8279'}}>{isPT ? meta.labelPt : meta.labelEn}</div>
                      <div style={{fontSize:13, fontWeight:700, color: name ? '#1a1512' : '#b0a89e'}}>{name || (isPT ? 'Por escolher' : 'Not chosen yet')}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          <Card title={isPT ? 'Líderes da Equipa' : 'Team Leaders'} icon="⭐">
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {leaders.map(l => (
                <div key={l.key} style={{display:'flex', alignItems:'center', gap:10}}>
                  <span style={{width:22, fontSize:10, fontWeight:800, color:'#8a8279'}}>{isPT ? l.labelPt : l.labelEn}</span>
                  {l.player ? (
                    <>
                      <div style={{width:26, height:26, borderRadius:'50%', flexShrink:0, overflow:'hidden', background:'#e8e2d6'}}>
                        {l.player.photo_url && <img src={l.player.photo_url} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/>}
                      </div>
                      <span style={{flex:1, fontSize:12, fontWeight:600, color:'#1a1512', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{l.player.name}</span>
                      <span style={{fontSize:13, fontWeight:800, color:teamColor}}>{l.value.toFixed(1)}</span>
                    </>
                  ) : <span style={{fontSize:12, color:'#b0a89e'}}>—</span>}
                </div>
              ))}
            </div>
          </Card>

          <Card title={isPT ? `Balanço — ${monthName}` : `Balance — ${monthName}`} icon="📊">
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {[
                { label: isPT ? 'Receita' : 'Revenue', value: finance?.revenue || 0, color: '#15803d' },
                { label: isPT ? 'Despesa' : 'Expense', value: finance?.expense || 0, color: '#dc2626' },
              ].map(row => (
                <div key={row.label}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3}}>
                    <span style={{color:'#5c554e', fontWeight:600}}>{row.label}</span>
                    <span style={{fontWeight:700, color: row.color}}>{fmtMoney(row.value)}</span>
                  </div>
                  <div style={{height:8, borderRadius:4, background:'#e8e2d6', overflow:'hidden'}}>
                    <div style={{height:'100%', width:`${Math.round((row.value/maxBar)*100)}%`, background: row.color, borderRadius:4}}/>
                  </div>
                </div>
              ))}
              <div style={{display:'flex', justifyContent:'space-between', fontSize:12, paddingTop:6, borderTop:'1px solid #e2dcd5'}}>
                <span style={{fontWeight:700, color:'#5c554e'}}>{isPT ? 'Líquido' : 'Net'}</span>
                <span style={{fontWeight:800, color: netFinance >= 0 ? '#15803d' : '#dc2626'}}>{fmtMoney(netFinance)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
