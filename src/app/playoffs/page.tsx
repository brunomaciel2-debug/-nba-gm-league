'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'

function sortConf(teams: any[]) {
  return [...teams].sort((a,b) => {
    const pctA = a.wins / Math.max(1, a.wins+a.losses)
    const pctB = b.wins / Math.max(1, b.wins+b.losses)
    return pctB - pctA || b.wins - a.wins || (b.pts_for-b.pts_against)-(a.pts_for-a.pts_against)
  })
}

// `extra` shows underneath the record — the actual series score (e.g.
// "2-1") once a real series is underway, instead of always the team's
// regular-season record, which stops meaning anything once the games that
// matter are playoff games.
function Seed({ team, seed, extra }: { team: any, seed: number|null, extra?: string }) {
  const isPlayin = seed!=null && seed >= 7
  const tc = team ? readableTeamColor(team.color) : '#9c9088'
  return (
    <div className="flex items-center gap-1.5 px-3 py-2.5 rounded"
         style={{
           background: isPlayin ? '#fef9c3' : '#faf8f5',
           border: `1px solid ${isPlayin ? '#f0c040' : '#d4cdc5'}`,
           minWidth: 0, width: '100%',
         }}>
      {seed!=null && <span className="text-xs font-black flex-shrink-0 w-5"
            style={{color: seed<=6?'#15803d':'#b45309',fontSize:15}}>{seed}</span>}
      {team?.logo_url
        ? <img src={team.logo_url} alt="" style={{width:32,height:32,objectFit:'contain',flexShrink:0}}/>
        : <div style={{width:32,height:32,borderRadius:3,background:tc+'22',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontSize:12,fontWeight:900,color:tc}}>{(team?.id||'?').slice(0,3)}</span>
          </div>
      }
      <Link href={team?`/team/${team.id}`:'#'} className="no-underline truncate" style={{fontSize:15,fontWeight:600,color: team?'#1a1512':'#9c9088',minWidth:0,pointerEvents:team?'auto':'none'}}>
        {team ? team.name.replace('Los Angeles','LA').replace('Golden State','GS').replace('Oklahoma City','OKC').replace('New Orleans','NO').replace('San Antonio','SA') : 'TBD'}
      </Link>
      <span className="flex-shrink-0" style={{fontSize:14,color:'#8a8279',marginLeft:'auto'}}>{extra||(team?`${team.wins}-${team.losses}`:'')}</span>
    </div>
  )
}

// One Play-In result row — a plain "vs" plus a caption underneath used to
// bury who actually won. Winner now gets a green highlight + checkmark,
// loser gets faded + struck through + a red "Eliminated" or blue "→ Game C"
// tag, so the outcome reads at a glance without following text elsewhere.
function PlayInTeamRow({ team, seed, isWinner, isLoser, fate, isPT }: { team:any, seed:number, isWinner:boolean, isLoser:boolean, fate?:'eliminated'|'advances', isPT:boolean }) {
  const tc = team ? readableTeamColor(team.color) : '#9c9088'
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{
      background: isWinner ? '#dcfce7' : '#faf8f5',
      border: `1.5px solid ${isWinner ? '#15803d' : '#e2dcd5'}`,
      opacity: isLoser ? 0.6 : 1,
    }}>
      <span className="text-xs font-black w-4 flex-shrink-0" style={{color: isWinner?'#15803d':'#8a8279'}}>{seed}</span>
      {team?.logo_url
        ? <img src={team.logo_url} alt="" style={{width:24,height:24,objectFit:'contain',flexShrink:0}}/>
        : <div style={{width:24,height:24,borderRadius:3,background:tc+'22',flexShrink:0}}/>}
      <Link href={team?`/team/${team.id}`:'#'} className="no-underline truncate flex-1" style={{
        fontSize:13, fontWeight: isWinner?800:600, color: isLoser?'#8a8279':'#1a1512',
        textDecoration: isLoser?'line-through':'none', pointerEvents: team?'auto':'none',
      }}>
        {team?.name || 'TBD'}
      </Link>
      {isWinner && <i className="ti ti-check" style={{color:'#15803d',fontSize:14,flexShrink:0}}></i>}
      {fate && (
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0" style={{
          background: fate==='eliminated' ? '#fee2e2' : '#dbeafe',
          color: fate==='eliminated' ? '#dc2626' : '#1d4ed8',
        }}>
          {fate==='eliminated' ? (isPT?'ELIMINADO':'ELIMINATED') : (isPT?'→ JOGO C':'→ GAME C')}
        </span>
      )}
    </div>
  )
}

// A full Play-In game card — both team rows plus a small header naming the
// game and, once decided, what's at stake for the loser (elimination vs a
// second life in Game C) instead of a caption line below the whole thing.
function PlayInGameCard({ label, hiTeam, hiSeed, loTeam, loSeed, completed, hiWon, loserFate, isPT }: {
  label:string, hiTeam:any, hiSeed:number, loTeam:any, loSeed:number, completed:boolean, hiWon:boolean, loserFate:'eliminated'|'advances', isPT:boolean
}) {
  return (
    <div className="rounded-xl p-2" style={{background:'#fff',border:'1px solid #e2dcd5'}}>
      <div className="text-[10px] font-black uppercase tracking-wide mb-1.5 px-1" style={{color:'#b45309',letterSpacing:'0.5px'}}>{label}</div>
      <div className="flex flex-col gap-1">
        <PlayInTeamRow team={hiTeam} seed={hiSeed} isWinner={completed&&hiWon} isLoser={completed&&!hiWon} fate={completed&&!hiWon?loserFate:undefined} isPT={isPT}/>
        <PlayInTeamRow team={loTeam} seed={loSeed} isWinner={completed&&!hiWon} isLoser={completed&&hiWon} fate={completed&&hiWon?loserFate:undefined} isPT={isPT}/>
      </div>
    </div>
  )
}

function Matchup({ hiTeam, loTeam, hiSeed, loSeed, series }: { hiTeam:any, loTeam:any, hiSeed:number|null, loSeed:number|null, series?:any }) {
  // Each row reads "own wins - opponent wins" from that team's own
  // perspective (matching real broadcasts), not the same shared string
  // twice — showing "2-4" under both teams read as if each independently
  // had a 2-4 record, rather than one 2-4 series between the two of them.
  const started = series && (series.wins_high>0||series.wins_low>0)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:3}}>
      <Seed team={hiTeam} seed={hiSeed} extra={started?`${series.wins_high}-${series.wins_low}`:undefined} />
      <Seed team={loTeam} seed={loSeed} extra={started?`${series.wins_low}-${series.wins_high}`:undefined} />
    </div>
  )
}

// A dashed placeholder box for a round that hasn't produced a real matchup
// yet — swapped for a real Matchup the moment playoff_series has at least
// one side filled in.
function PendingBox({ label }: { label:string }) {
  return (
    <div style={{height:58,background:'#f0ece5',border:'1px dashed #d4cdc5',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <span style={{fontSize:14,color:'#8a8279',fontWeight:600}}>{label}</span>
    </div>
  )
}

export default function PlayoffsPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [teams, setTeams] = useState<any[]>([])
  const [series, setSeries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('teams').select('id,name,color,logo_url,wins,losses,conference,pts_for,pts_against')
        .not('id','in','(ALL,RVS,ROO,SOP)'),
      supabase.from('playoff_series').select('*').eq('season','2025-26'),
    ]).then(([{data:t},{data:s}]) => { setTeams(t||[]); setSeries(s||[]); setLoading(false) })
  }, [])

  if (loading) return <div className="text-center py-12" style={{color:'#8a8279'}}>{t('common.loading')}</div>

  const teamMap = Object.fromEntries(teams.map((tm:any)=>[tm.id,tm]))
  const east = sortConf(teams.filter((t:any) => t.conference === 'Eastern'))
  const west = sortConf(teams.filter((t:any) => t.conference === 'Western'))
  const TBD = 'TBD'

  // Once the bracket has been seeded (see seedNBAPlayoffBracket in
  // playoff-resolver.ts), playoff_series — not the live standings — is the
  // real source of truth: seeds are locked in, and a team's regular-season
  // record stops being what matters once real playoff games start. Before
  // that point (still regular season), there's nothing seeded yet, so this
  // falls back to the same "projected from current standings" picture as
  // always.
  const hasRealBracket = series.length > 0
  const seriesByType: Record<string,any> = {}
  series.forEach((s:any) => { seriesByType[s.series_type] = s })

  // East: 1-6 direct, 7&8 = TBD from play-in
  const eTop = east.slice(0,10)
  const wTop = west.slice(0,10)

  // Resolves a series into { hiTeam, loTeam, hiSeed, loSeed } — real teams
  // (with real seeds, once known) if the bracket is seeded, otherwise the
  // pre-playoff standings projection.
  const round1Matchup = (conf:'eastern'|'western', slot:'1v8'|'2v7'|'3v6'|'4v5', projHi:any, projLo:any, projHiSeed:number, projLoSeed:number) => {
    const s = seriesByType[`r1_${conf}_${slot}`]
    if (!hasRealBracket) return { hiTeam:projHi, loTeam:projLo, hiSeed:projHiSeed, loSeed:projLoSeed, series:undefined }
    return {
      hiTeam: s?.team_high ? teamMap[s.team_high] : null,
      loTeam: s?.team_low ? teamMap[s.team_low] : null,
      hiSeed: s?.seed_high ?? projHiSeed, loSeed: s?.seed_low ?? projLoSeed,
      series: s,
    }
  }
  const r1 = {
    east_1v8: round1Matchup('eastern','1v8', eTop[0], null, 1, 8),
    east_4v5: round1Matchup('eastern','4v5', eTop[3], eTop[4], 4, 5),
    east_2v7: round1Matchup('eastern','2v7', eTop[1], null, 2, 7),
    east_3v6: round1Matchup('eastern','3v6', eTop[2], eTop[5], 3, 6),
    west_1v8: round1Matchup('western','1v8', wTop[0], null, 1, 8),
    west_4v5: round1Matchup('western','4v5', wTop[3], wTop[4], 4, 5),
    west_2v7: round1Matchup('western','2v7', wTop[1], null, 2, 7),
    west_3v6: round1Matchup('western','3v6', wTop[2], wTop[5], 3, 6),
  }

  // Later rounds have no standings-based projection to fall back to (their
  // participants are never guessable from regular-season order alone) — a
  // dashed TBD box until the bracket is seeded AND that round's teams are
  // actually decided.
  const laterRound = (seriesType:string) => {
    const s = seriesByType[seriesType]
    return {
      hiTeam: s?.team_high ? teamMap[s.team_high] : null,
      loTeam: s?.team_low ? teamMap[s.team_low] : null,
      series: s,
    }
  }
  const r2EastA = laterRound('r2_eastern_a'), r2EastB = laterRound('r2_eastern_b')
  const r2WestA = laterRound('r2_western_a'), r2WestB = laterRound('r2_western_b')
  const cfEast = laterRound('conf_final_eastern'), cfWest = laterRound('conf_final_western')
  const finals = laterRound('nba_finals')

  const RoundBox = ({ m, label }: { m:{hiTeam:any,loTeam:any,series?:any}, label:string }) =>
    (m.hiTeam || m.loTeam)
      ? <Matchup hiTeam={m.hiTeam} loTeam={m.loTeam} hiSeed={null} loSeed={null} series={m.series}/>
      : <><PendingBox label={label}/><PendingBox label={TBD}/></>

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="sec-hdr mb-2">
        <span className="sec-title">
          <i className="ti ti-tournament" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
          {isPT ? 'Quadro de Playoffs 2025-26' : '2025-26 Playoff Bracket'}
        </span>
        <Link href="/standings" className="text-xs no-underline font-semibold" style={{color:'#c8102e'}}>
          {isPT ? 'Classificação →' : 'Standings →'}
        </Link>
      </div>
      <p className="text-xs mb-6" style={{color:'#8a8279'}}>
        {hasRealBracket
          ? (isPT ? 'Quadro real dos Playoffs — actualiza a cada simulação.' : 'The real Playoff bracket — updates after each simulation.')
          : (isPT
              ? 'Baseado na classificação actual. As posições 7 e 8 são decididas pelo Play-In Tournament. Actualiza a cada simulação.'
              : 'Based on current standings. Seeds 7 & 8 are determined by the Play-In Tournament. Updates after each simulation.')}
      </p>

      {/* BRACKET — East left, West right, Finals center */}
      <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:'0 16px',alignItems:'center'}}>

        {/* ── EAST (left side, reads inward) ── */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3 text-center"
               style={{color:'#1e3a8a',letterSpacing:'1.5px'}}>{isPT?'Conferência Este':'Eastern Conference'}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',alignItems:'center'}}>

            {/* Round 1 — leftmost */}
            <div style={{display:'flex',flexDirection:'column',gap:40}}>
              <Matchup hiTeam={r1.east_1v8.hiTeam} loTeam={r1.east_1v8.loTeam} hiSeed={r1.east_1v8.hiSeed} loSeed={r1.east_1v8.loSeed} series={r1.east_1v8.series} />
              <Matchup hiTeam={r1.east_4v5.hiTeam} loTeam={r1.east_4v5.loTeam} hiSeed={r1.east_4v5.hiSeed} loSeed={r1.east_4v5.loSeed} series={r1.east_4v5.series} />
              <Matchup hiTeam={r1.east_2v7.hiTeam} loTeam={r1.east_2v7.loTeam} hiSeed={r1.east_2v7.hiSeed} loSeed={r1.east_2v7.loSeed} series={r1.east_2v7.series} />
              <Matchup hiTeam={r1.east_3v6.hiTeam} loTeam={r1.east_3v6.loTeam} hiSeed={r1.east_3v6.hiSeed} loSeed={r1.east_3v6.loSeed} series={r1.east_3v6.series} />
            </div>

            {/* Conf Semis */}
            <div style={{display:'flex',flexDirection:'column',gap:112,justifyContent:'space-around'}}>
              <RoundBox m={r2EastA} label={isPT?'MEIA A':'SEMI A'} />
              <RoundBox m={r2EastB} label={isPT?'MEIA B':'SEMI B'} />
            </div>

            {/* Conf Finals */}
            <div style={{display:'flex',flexDirection:'column',gap:2,alignSelf:'center'}}>
              {(cfEast.hiTeam || cfEast.loTeam)
                ? <Matchup hiTeam={cfEast.hiTeam} loTeam={cfEast.loTeam} hiSeed={null} loSeed={null} series={cfEast.series}/>
                : <div style={{height:62,background:'#e8f0fe',border:'1px dashed #1e3a8a44',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{fontSize:14,color:'#1e3a8a',fontWeight:700}}>{isPT?'FINAL ESTE':'EAST FINAL'}</span>
                  </div>}
            </div>
          </div>
        </div>

        {/* ── NBA FINALS (center) ── */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,minWidth:100}}>
          <i className="ti ti-trophy" style={{fontSize:40,color:'#c8102e',marginBottom:4}}></i>
          <div style={{fontSize:14,fontWeight:700,color:'#c8102e',letterSpacing:'1px',textTransform:'uppercase',textAlign:'center',marginBottom:8}}>{isPT?'Finais NBA':'NBA Finals'}</div>
          {(() => {
            const finalsStarted = finals.series && (finals.series.wins_high>0||finals.series.wins_low>0)
            return (
              <>
                {finals.hiTeam
                  ? <Seed team={finals.hiTeam} seed={null} extra={finalsStarted?`${finals.series.wins_high}-${finals.series.wins_low}`:undefined}/>
                  : <div style={{width:140,height:62,background:'#fff0f0',border:'1.5px dashed #c8102e',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:14,color:'#c8102e',fontWeight:700}}>{isPT?'ESTE':'EAST'}</span>
                    </div>}
                <div style={{fontSize:14,color:'#d4cdc5',fontWeight:700,margin:'2px 0'}}>vs</div>
                {finals.loTeam
                  ? <Seed team={finals.loTeam} seed={null} extra={finalsStarted?`${finals.series.wins_low}-${finals.series.wins_high}`:undefined}/>
                  : <div style={{width:140,height:62,background:'#fff0f0',border:'1.5px dashed #c8102e',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:14,color:'#c8102e',fontWeight:700}}>{isPT?'OESTE':'WEST'}</span>
                    </div>}
              </>
            )
          })()}
          <div style={{fontSize:13,color:'#8a8279',marginTop:6,textAlign:'center'}}>{isPT?'Melhor de 7':'Best of 7'}</div>
        </div>

        {/* ── WEST (right side, reads inward) ── */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3 text-center"
               style={{color:'#7c2d12',letterSpacing:'1.5px'}}>{isPT?'Conferência Oeste':'Western Conference'}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',alignItems:'center'}}>

            {/* Conf Finals */}
            <div style={{display:'flex',flexDirection:'column',gap:2,alignSelf:'center'}}>
              {(cfWest.hiTeam || cfWest.loTeam)
                ? <Matchup hiTeam={cfWest.hiTeam} loTeam={cfWest.loTeam} hiSeed={null} loSeed={null} series={cfWest.series}/>
                : <div style={{height:62,background:'#fef3e8',border:'1px dashed #7c2d1244',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{fontSize:14,color:'#7c2d12',fontWeight:700}}>{isPT?'FINAL OESTE':'WEST FINAL'}</span>
                  </div>}
            </div>

            {/* Conf Semis */}
            <div style={{display:'flex',flexDirection:'column',gap:112,justifyContent:'space-around'}}>
              <RoundBox m={r2WestA} label={isPT?'MEIA A':'SEMI A'} />
              <RoundBox m={r2WestB} label={isPT?'MEIA B':'SEMI B'} />
            </div>

            {/* Round 1 — rightmost */}
            <div style={{display:'flex',flexDirection:'column',gap:40}}>
              <Matchup hiTeam={r1.west_1v8.hiTeam} loTeam={r1.west_1v8.loTeam} hiSeed={r1.west_1v8.hiSeed} loSeed={r1.west_1v8.loSeed} series={r1.west_1v8.series} />
              <Matchup hiTeam={r1.west_4v5.hiTeam} loTeam={r1.west_4v5.loTeam} hiSeed={r1.west_4v5.hiSeed} loSeed={r1.west_4v5.loSeed} series={r1.west_4v5.series} />
              <Matchup hiTeam={r1.west_2v7.hiTeam} loTeam={r1.west_2v7.loTeam} hiSeed={r1.west_2v7.hiSeed} loSeed={r1.west_2v7.loSeed} series={r1.west_2v7.series} />
              <Matchup hiTeam={r1.west_3v6.hiTeam} loTeam={r1.west_3v6.loTeam} hiSeed={r1.west_3v6.hiSeed} loSeed={r1.west_3v6.loSeed} series={r1.west_3v6.series} />
            </div>
          </div>
        </div>
      </div>

      {/* Play-In legend — real results once the bracket is seeded, the
          projected format explanation before that. */}
      <div className="mt-8 rounded-xl p-4" style={{background:'#fef9c3',border:'1px solid #b45309'}}>
        <div className="text-xs font-bold mb-2" style={{color:'#b45309'}}>
          <i className="ti ti-tournament" style={{marginRight:4}}></i>
          {isPT ? 'Play-In Tournament — posições 7-10' : 'Play-In Tournament — seeds 7-10'}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {([[isPT?'Este':'Eastern','eastern',eTop],[isPT?'Oeste':'Western','western',wTop]] as [string,'eastern'|'western',any[]][]).map(([conf,c,ranked]) => {
            const a = seriesByType[`playin_a_${c}`], b = seriesByType[`playin_b_${c}`], cc = seriesByType[`playin_c_${c}`]
            const aHi = hasRealBracket?(a?.team_high?teamMap[a.team_high]:null):ranked[6]
            const aLo = hasRealBracket?(a?.team_low?teamMap[a.team_low]:null):ranked[7]
            const bHi = hasRealBracket?(b?.team_high?teamMap[b.team_high]:null):ranked[8]
            const bLo = hasRealBracket?(b?.team_low?teamMap[b.team_low]:null):ranked[9]
            const aCompleted = hasRealBracket && a?.status==='completed'
            const bCompleted = hasRealBracket && b?.status==='completed'
            const ccHi = hasRealBracket && cc?.team_high ? teamMap[cc.team_high] : null
            const ccLo = hasRealBracket && cc?.team_low ? teamMap[cc.team_low] : null
            const ccCompleted = hasRealBracket && cc?.status==='completed'
            return (
              <div key={conf} className="rounded-xl p-3" style={{background:'#fffdf5',border:'1px solid #f0e6b8'}}>
                <div className="text-xs font-bold mb-2" style={{color:'#8a8279'}}>{conf}</div>
                <div className="flex flex-col gap-2">
                  <PlayInGameCard label={isPT?'Jogo A':'Game A'} hiTeam={aHi} hiSeed={7} loTeam={aLo} loSeed={8}
                    completed={aCompleted} hiWon={!!(a && a.wins_high>a.wins_low)} loserFate="advances" isPT={isPT}/>
                  <PlayInGameCard label={isPT?'Jogo B':'Game B'} hiTeam={bHi} hiSeed={9} loTeam={bLo} loSeed={10}
                    completed={bCompleted} hiWon={!!(b && b.wins_high>b.wins_low)} loserFate="eliminated" isPT={isPT}/>
                  <PlayInGameCard label={isPT?'Jogo C — decide a posição #8':'Game C — decides the #8 seed'} hiTeam={ccHi} hiSeed={8} loTeam={ccLo} loSeed={9}
                    completed={ccCompleted} hiWon={!!(cc && cc.wins_high>cc.wins_low)} loserFate="eliminated" isPT={isPT}/>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
