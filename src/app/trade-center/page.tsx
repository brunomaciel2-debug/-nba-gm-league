'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import Link from 'next/link'

type Tab = 'players' | 'staff' | 'tradeblock'


// ── STAFF TABLE COMPONENT ───────────────────────────────────────
function StaffTable({ staff, filter, setFilter, user, myTeamId, capFmt }: any) {
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')

  const ROLE_COLORS: Record<string,string> = {
    head_coach:'#ffd040', assistant_coach:'#60a0ff', trainer:'#40e080', physio:'#c040ff'
  }

  const filtered = staff.filter((c:any) => filter==='all' || c.role===filter)

  const mainAttr = (c: any) => {
    if (c.role==='physio') return c.rehab_speed||0
    if (c.role==='trainer') return Math.round(((c.conditioning||0)+(c.recovery_boost||0)+(c.injury_prevent||0))/3)
    return Math.round(((c.off_adjustment||0)+(c.def_adjustment||0)+(c.off_development||0)+(c.def_development||0)+(c.tactical_dev||0))/5)
  }

  const suggestedSalary = (c: any) => {
    const avg = mainAttr(c)
    const base = c.role==='head_coach'?12000000:c.role==='assistant_coach'?3000000:c.role==='trainer'?900000:700000
    return Math.round((avg/100)*base/100000)*100000
  }

  const sorted = [...filtered].sort((a:any,b:any) => {
    let av = 0, bv = 0
    if (sortKey==='name') { av = a.name?.localeCompare(b.name)||0; return sortDir==='asc'?av:-av }
    if (sortKey==='age') { av=a.age||0; bv=b.age||0 }
    if (sortKey==='attr') { av=mainAttr(a); bv=mainAttr(b) }
    if (sortKey==='salary') { av=suggestedSalary(a); bv=suggestedSalary(b) }
    if (sortKey==='oa') { av=a.off_adjustment||0; bv=b.off_adjustment||0 }
    if (sortKey==='da') { av=a.def_adjustment||0; bv=b.def_adjustment||0 }
    if (sortKey==='od') { av=a.off_development||0; bv=b.off_development||0 }
    if (sortKey==='dd') { av=a.def_development||0; bv=b.def_development||0 }
    if (sortKey==='cond') { av=a.conditioning||0; bv=b.conditioning||0 }
    if (sortKey==='rec') { av=a.recovery_boost||0; bv=b.recovery_boost||0 }
    if (sortKey==='inj') { av=a.injury_prevent||0; bv=b.injury_prevent||0 }
    if (sortKey==='rehab') { av=a.rehab_speed||0; bv=b.rehab_speed||0 }
    return sortDir==='asc' ? av-bv : bv-av
  })

  const toggleSort = (key: string) => {
    if (sortKey===key) setSortDir(d => d==='asc'?'desc':'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const Th = ({ k, label }: { k:string, label:string }) => (
    <th className="px-3 py-2.5 text-left cursor-pointer select-none whitespace-nowrap"
        style={{color:sortKey===k?'#F5A623':'#6b6258',fontSize:11,fontWeight:600,letterSpacing:'0.5px',
                background:'#ddd7ca',borderBottom:'1px solid #ddd8ce'}}
        onClick={()=>toggleSort(k)}>
      {label}{sortKey===k&&<span className="ml-1">{sortDir==='asc'?'↑':'↓'}</span>}
    </th>
  )

  const isCoach = (role:string) => role==='head_coach'||role==='assistant_coach'

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {['all','head_coach','assistant_coach','trainer','physio'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{background:filter===f?'#1f2937':'#ede8df',
                    color:filter===f?'#1c1917':'#6b6258',
                    border:'1px solid '+(filter===f?'#3d3731':'#cec8be')}}>
            {f==='all'?'All Roles':f.replace(/_/g,' ').replace(/\w/g,(c:string)=>c.toUpperCase())}
          </button>
        ))}
        <span className="ml-auto text-xs" style={{color:'#9c8e7a'}}>{sorted.length} available</span>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{border:'1px solid #ddd8ce'}}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <Th k="name"   label="NAME" />
                <Th k="age"    label="AGE" />
                {(filter==='all'||isCoach(filter)) && <>
                  <Th k="oa"   label="OFF ADJ" />
                  <Th k="da"   label="DEF ADJ" />
                  <Th k="od"   label="OFF DEV" />
                  <Th k="dd"   label="DEF DEV" />
                </>}
                {(filter==='all'||filter==='trainer') && <>
                  <Th k="cond" label="COND" />
                  <Th k="rec"  label="REC" />
                  <Th k="inj"  label="INJ PREV" />
                </>}
                {(filter==='all'||filter==='physio') && <Th k="rehab" label="REHAB" />}
                <Th k="attr"   label="RATING" />
                <th style={{background:'#ddd7ca',borderBottom:'1px solid #ddd8ce'}}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length===0 ? (
                <tr><td colSpan={12} className="px-4 py-8 text-center" style={{color:'#9c8e7a'}}>No staff available.</td></tr>
              ) : sorted.map((c:any, i:number) => {
                const rc = ROLE_COLORS[c.role]||'#6b6258'
                const attr = mainAttr(c)
                const attrColor = attr>=80?'#ffd040':attr>=70?'#40e080':attr>=60?'#60a0ff':'#6b6258'
                return (
                  <tr key={c.id} style={{background:i%2===0?'#ece7dd':'#e8e2d6',borderBottom:'1px solid #ddd8ce'}}>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold" style={{color:'#1a1612'}}>{c.name}</div>
                      <div className="text-xs mt-0.5" style={{color:rc}}>{c.role.replace(/_/g,' ')}</div>
                    </td>
                    <td className="px-3 py-2.5" style={{color:'#6b5f4e'}}>{c.age||'—'}<span className="ml-0.5" style={{color:'#b8ae9e',fontSize:10}}>{c.nationality?` ${c.nationality}`:''}</span></td>
                    {(filter==='all'||isCoach(filter)) && <>
                      <td className="px-3 py-2.5 text-center font-semibold" style={{color:c.off_adjustment>=75?'#ffa040':'#6b6258'}}>{c.off_adjustment||'—'}</td>
                      <td className="px-3 py-2.5 text-center font-semibold" style={{color:c.def_adjustment>=75?'#40e080':'#6b6258'}}>{c.def_adjustment||'—'}</td>
                      <td className="px-3 py-2.5 text-center font-semibold" style={{color:c.off_development>=75?'#ffa040':'#6b6258'}}>{c.off_development||'—'}</td>
                      <td className="px-3 py-2.5 text-center font-semibold" style={{color:c.def_development>=75?'#40e080':'#6b6258'}}>{c.def_development||'—'}</td>
                    </>}
                    {(filter==='all'||filter==='trainer') && <>
                      <td className="px-3 py-2.5 text-center font-semibold" style={{color:c.conditioning>=75?'#40e080':'#6b6258'}}>{c.conditioning||'—'}</td>
                      <td className="px-3 py-2.5 text-center font-semibold" style={{color:c.recovery_boost>=75?'#60a0ff':'#6b6258'}}>{c.recovery_boost||'—'}</td>
                      <td className="px-3 py-2.5 text-center font-semibold" style={{color:c.injury_prevent>=75?'#ffd040':'#6b6258'}}>{c.injury_prevent||'—'}</td>
                    </>}
                    {(filter==='all'||filter==='physio') && <td className="px-3 py-2.5 text-center font-semibold" style={{color:c.rehab_speed>=75?'#c040ff':'#6b6258'}}>{c.rehab_speed||'—'}</td>}
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-black" style={{color:attrColor}}>{attr}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {user && myTeamId && (
                        <a href={`/trade-center/staff-offer?coach=${c.id}`}
                           className="text-xs font-bold px-3 py-1.5 rounded-lg no-underline whitespace-nowrap"
                           style={{background:rc+'22',color:rc,border:'1px solid '+rc+'33'}}>
                          Offer
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function TradeCenterPage() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState<Tab>('players')
  const [teams, setTeams] = useState<any[]>([])
  const [tradeBlock, setTradeBlock] = useState<any[]>([])
  const [freeStaff, setFreeStaff] = useState<any[]>([])
  const [staffFilter, setStaffFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('teams').select('*, players(id,name,pos,salary,health,moral,usage)')
        .not('id','in','(ALL,RVS)').order('name'),
      supabase.from('trade_block').select('*, players(id,name,pos,salary,team_id,health), teams(id,name,color,logo_url)')
        .eq('status','available').order('created_at',{ascending:false}),
      supabase.from('coaches').select('*').is('team_id',null).order('role').order('name'),
    ]).then(([{data:ts},{data:tb},{data:fs}]) => {
      setTeams(ts||[])
      setTradeBlock(tb||[])
      setFreeStaff(fs||[])
      setLoading(false)
    })
  }, [])

  const myTeamId = profile?.team_id
  const isCommissioner = profile?.role === 'commissioner'
  const capFmt = (n:number) => n>=1000000?'$'+(n/1000000).toFixed(1)+'M':'$'+n?.toLocaleString()

  const ROLE_COLORS: Record<string,string> = {
    head_coach:'#ffd040',assistant_coach:'#60a0ff',trainer:'#40e080',physio:'#c040ff'
  }

  const filteredStaff = freeStaff.filter(c =>
    staffFilter==='all' || c.role===staffFilter
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1a1612'}}>🔄 Trade Center</h1>
          <p className="text-sm" style={{color:'#6b5f4e'}}>
            {myTeamId ? `Managing: ${profile?.teams?.name}` : 'Browse trades and staff signings'}
          </p>
        </div>
        {!user && (
          <Link href="/login" className="no-underline px-4 py-2 rounded-lg text-sm font-bold"
                style={{background:'#3a8adf',color:'#e8e2d6'}}>Sign In to Trade</Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          {key:'players',    label:'🏀 Player Trades'},
          {key:'staff',      label:'👔 Staff Free Agency'},
          {key:'tradeblock', label:'📋 Trade Block'},
        ].map((t:any)=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{background:tab===t.key?'#cec8be':'#ede8df',
                    color:tab===t.key?'#1c1917':'#6b6258',
                    border:'1px solid '+(tab===t.key?'#9c9088':'#cec8be')}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12" style={{color:'#6b5f4e'}}>Loading...</div>
      ) : (
        <>
          {/* ── PLAYER TRADES ─────────────────────────── */}
          {tab==='players' && (
            <div>
              <p className="text-xs mb-4" style={{color:'#6b5f4e'}}>
                Click a team to propose a trade. Players on the trade block are highlighted.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map(t => {
                  const tc = readableTeamColor(t.color)
                  const isMyTeam = myTeamId ? t.id === myTeamId : false
                  const tbPlayerIds = new Set(tradeBlock.filter(tb=>tb.teams?.id===t.id).map(tb=>tb.players?.id))
                  return (
                    <div key={t.id} className="rounded-xl overflow-hidden"
                         style={{border:'1px solid '+(isMyTeam?tc+'55':'#cec8be')}}>
                      {/* Team header — clickable */}
                      <Link href={`/team/${t.id}`} className="no-underline">
                        <div className="flex items-center gap-2 px-4 py-3 transition-all hover:brightness-125"
                             style={{background:'#ede8de',borderBottom:tbPlayerIds.size>0?'1px solid #3a3228':'none'}}>
                          {t.logo_url && <img src={t.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0"/>}
                          <span className="font-bold text-sm flex-1" style={{color:isMyTeam?tc:'#1c1917'}}>{t.name}</span>
                          {isMyTeam && <span className="text-xs" style={{color:tc}}>Your Team</span>}
                        </div>
                      </Link>
                      {/* Trade block players — only if any */}
                      {tbPlayerIds.size > 0 && (
                        <div className="px-4 py-2" style={{background:'#ddd7ca'}}>
                          <div className="text-xs mb-1.5 font-semibold" style={{color:'#b45309'}}>📋 Trade Block</div>
                          {tradeBlock.filter(tb=>tb.teams?.id===t.id).map((tb:any)=>(
                            <div key={tb.id} className="flex items-center gap-2 py-1"
                                 style={{borderBottom:'1px solid #ddd8ce'}}>
                              <span className="text-xs w-7 flex-shrink-0" style={{color:'#6b5f4e'}}>{tb.players?.pos}</span>
                              <span className="text-xs flex-1 font-semibold" style={{color:'#b45309'}}>{tb.players?.name}</span>
                              <span className="text-xs" style={{color:'#6b5f4e'}}>{capFmt(tb.players?.salary)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Propose button */}
                      {!isMyTeam && user && myTeamId !== t.id && (
                        <div className="px-4 py-2" style={{borderTop:'1px solid #2a2218'}}>
                          <Link href={`/trade-center/propose?to=${t.id}`}
                                className="block text-center text-xs font-semibold py-1.5 rounded-lg no-underline"
                                style={{background:'#dbeafe',color:'#1e40af'}}>
                            Propose Trade →
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── STAFF FREE AGENCY ──────────────────────── */}
          {tab==='staff' && (
            <StaffTable
              staff={freeStaff}
              filter={staffFilter}
              setFilter={setStaffFilter}
              user={user}
              myTeamId={myTeamId}
              capFmt={capFmt}
            />
          )}

          {/* ── TRADE BLOCK ─────────────────────────────── */}
          {tab==='tradeblock' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs" style={{color:'#6b5f4e'}}>
                  Players placed on the trade block by their GMs, in chronological order.
                </p>
                {user && myTeamId && (
                  <Link href="/trade-center/manage-block"
                        className="text-xs px-3 py-1.5 rounded-lg no-underline font-semibold"
                        style={{background:'#dbeafe',color:'#1e40af'}}>
                    Manage My Block →
                  </Link>
                )}
              </div>
              {tradeBlock.length===0?(
                <div className="rounded-xl p-8 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                  <p style={{color:'#6b5f4e'}}>No players on the trade block yet.</p>
                </div>
              ):(
                <div className="flex flex-col gap-2">
                  {tradeBlock.map(tb => {
                    const tc = readableTeamColor(tb.teams?.color||'555')
                    return (
                      <div key={tb.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                           style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0"
                             style={{background:tc+'22'}}>
                          {tb.teams?.logo_url
                            ?<img src={tb.teams.logo_url} alt="" className="w-full h-full object-contain p-1"/>
                            :<div className="w-full h-full flex items-center justify-center text-xs font-black"
                                  style={{color:tc}}>{tb.teams?.id?.slice(0,2)}</div>}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold" style={{color:'#1a1612'}}>{tb.players?.name}</div>
                          <div className="text-xs" style={{color:'#6b5f4e'}}>
                            {tb.players?.pos} · {tb.teams?.name} · {capFmt(tb.players?.salary)}
                          </div>
                          {tb.notes && <div className="text-xs mt-0.5" style={{color:'#6b5f4e'}}>"{tb.notes}"</div>}
                        </div>
                        <div className="text-xs" style={{color:'#b8ae9e'}}>
                          {new Date(tb.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                        </div>
                        {user && myTeamId !== tb.teams?.id && (
                          <Link href={`/trade-center/propose?to=${tb.teams?.id}&player=${tb.players?.id}`}
                                className="text-xs px-3 py-1.5 rounded-lg no-underline font-semibold flex-shrink-0"
                                style={{background:'#fef3c7',color:'#b45309'}}>
                            Propose Trade
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
