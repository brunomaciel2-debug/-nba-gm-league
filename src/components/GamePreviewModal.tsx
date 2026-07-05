'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { homeWinProb, fmtPct } from '@/lib/elo-helper'
import { getMarqueeInfoForDate, getMarqueeLabelText } from '@/lib/marquee-dates'

const MARQUEE_ICON: Record<string, string> = {
  'Christmas Day': '🎄', 'Thanksgiving': '🦃', 'MLK Day': '✊🏾',
  "Presidents' Day": '🎩', 'NBA Cup Championship': '🏆', 'Opening Night': '🎬',
}

export default function GamePreviewModal({ game, teams, isPT, onClose }: {
  game: any, teams: Record<string, any>, isPT: boolean, onClose: () => void
}) {
  const [referee, setReferee] = useState<any>(null)
  const [h2h, setH2h] = useState<{ homeWins: number, awayWins: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const home = teams[game.home_team]
  const away = teams[game.away_team]
  const gameDate = game.played_at || (game.scheduled_date ? game.scheduled_date + 'T12:00:00' : null)
  const marquee = (game.week_number > 0 && gameDate) ? getMarqueeInfoForDate(gameDate, game.week_number) : { marquee: false }

  useEffect(() => {
    (async () => {
      const [{ data: ref }, { data: pastGames }] = await Promise.all([
        game.referee_id ? supabase.from('referees').select('id,name,photo_url').eq('id', game.referee_id).single() : Promise.resolve({ data: null }),
        supabase.from('games').select('home_team,away_team,home_score,away_score')
          .eq('status', 'final')
          .or(`and(home_team.eq.${game.home_team},away_team.eq.${game.away_team}),and(home_team.eq.${game.away_team},away_team.eq.${game.home_team})`),
      ])
      setReferee(ref)
      let homeWins = 0, awayWins = 0
      ;(pastGames || []).forEach((g: any) => {
        const homeTeamWon = g.home_score > g.away_score
        const winner = homeTeamWon ? g.home_team : g.away_team
        if (winner === game.home_team) homeWins++
        else awayWins++
      })
      setH2h({ homeWins, awayWins })
      setLoading(false)
    })()
  }, [game.id])

  const homeElo = home?.elo ?? 1500
  const awayElo = away?.elo ?? 1500
  const homeProb = homeWinProb(homeElo, awayElo)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#faf8f5', border: '1px solid #d4cdc5' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: '#8a8279' }}>
            {isPT ? 'Antevisão do Jogo' : 'Game Preview'}
          </h2>
          <button onClick={onClose} style={{ color: '#8a8279', fontSize: 20 }}>✕</button>
        </div>

        {marquee.marquee && (
          <div className="text-center text-xs font-bold px-2 py-1 rounded-lg mb-4" style={{ background: '#fef9c3', color: '#b45309' }}>
            {MARQUEE_ICON[marquee.label || ''] || '⭐'} {getMarqueeLabelText(marquee.label || '', isPT)}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex-1 text-center">
            {home?.logo_url && <img src={home.logo_url} alt="" className="w-14 h-14 object-contain mx-auto mb-1" />}
            <Link href={`/team/${game.home_team}`} className="text-sm font-bold no-underline hover:underline block" style={{ color: readableTeamColor(home?.color) }}>
              {home?.name || game.home_team}
            </Link>
            <div className="text-xs" style={{ color: '#8a8279' }}>{home?.wins ?? 0}-{home?.losses ?? 0}</div>
          </div>
          <div className="text-xs font-bold" style={{ color: '#8a8279' }}>{isPT ? 'vs' : 'vs'}</div>
          <div className="flex-1 text-center">
            {away?.logo_url && <img src={away.logo_url} alt="" className="w-14 h-14 object-contain mx-auto mb-1" />}
            <Link href={`/team/${game.away_team}`} className="text-sm font-bold no-underline hover:underline block" style={{ color: readableTeamColor(away?.color) }}>
              {away?.name || game.away_team}
            </Link>
            <div className="text-xs" style={{ color: '#8a8279' }}>{away?.wins ?? 0}-{away?.losses ?? 0}</div>
          </div>
        </div>

        {gameDate && (
          <div className="text-center text-xs mb-1" style={{ color: '#8a8279' }}>
            📅 {new Date(gameDate).toLocaleDateString(isPT ? 'pt-PT' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        )}
        {home?.arena && (
          <div className="text-center text-xs mb-4" style={{ color: '#8a8279' }}>🏟️ {home.arena}</div>
        )}

        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-sm font-black px-3 py-1 rounded-lg" style={{ background: homeProb >= 0.5 ? '#dcfce7' : '#fee2e2', color: homeProb >= 0.5 ? '#15803d' : '#dc2626' }}>
            {fmtPct(homeProb)}
          </span>
          <span className="text-xs" style={{ color: '#9c8e7a' }}>{isPT ? 'odds' : 'odds'}</span>
          <span className="text-sm font-black px-3 py-1 rounded-lg" style={{ background: '#f0ece5', color: '#6b5f4e' }}>
            {fmtPct(1 - homeProb)}
          </span>
        </div>

        {!loading && h2h && (h2h.homeWins + h2h.awayWins) > 0 && (
          <div className="text-center text-xs mb-4" style={{ color: '#5c554e' }}>
            {isPT ? 'Confronto direto esta época:' : 'Head-to-head this season:'}{' '}
            <span className="font-bold">{h2h.homeWins}-{h2h.awayWins}</span>
            {' '}({home?.name})
          </div>
        )}

        {!loading && referee && (
          <div className="text-center text-xs pt-3" style={{ borderTop: '1px solid #e2dcd5', color: '#5c554e' }}>
            👨‍⚖️ {isPT ? 'Árbitro:' : 'Referee:'}{' '}
            <Link href={`/referees/${referee.id}`} className="font-bold no-underline hover:underline" style={{ color: '#1d4ed8' }}>
              {referee.name}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
