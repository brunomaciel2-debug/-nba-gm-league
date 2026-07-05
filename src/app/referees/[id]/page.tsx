'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { REFEREE_TRAIT_META } from '@/lib/referee-traits'
import { useTranslation } from '@/components/I18nProvider'

// What each trait actually does in the simulator — the real formulas from
// src/lib/game-simulator.ts, not decorative labels.
const TRAIT_TIPS_EN: Record<string, string> = {
  foul_rate: 'How often this referee whistles a foul at all — scales the base foul rate from 0.7x (rarely calls anything) to 1.3x (calls everything) at the extremes.',
  crowd_error_rate: 'Extra fouls/errors specifically once the arena is genuinely packed (attendance above ~75%) — a ref who gets rattled by a loud, sold-out crowd, not a flat modifier.',
  technical_impatience: 'How quickly this referee reaches for a technical foul — scales the whole technical-foul rate from 0.6x (very tolerant) to 1.4x (short fuse), even higher in rivalry or decisive games.',
  home_bias: 'Tilts foul-calling up to ±8% in favor of whichever side is home — a ref who (consciously or not) gives the home crowd a break.',
}
const TRAIT_TIPS_PT: Record<string, string> = {
  foul_rate: 'Com que frequência este árbitro marca falta, de um modo geral — varia a taxa base de faltas de 0.7x (marca poucas) a 1.3x (marca quase tudo) nos extremos.',
  crowd_error_rate: 'Faltas/erros extra especificamente quando a arena está mesmo cheia (assistência acima de ~75%) — um árbitro que se deixa afetar por uma casa cheia e barulhenta, não um modificador fixo.',
  technical_impatience: 'Com que rapidez este árbitro marca falta técnica — varia a taxa de técnicas de 0.6x (muito tolerante) a 1.4x (pavio curto), ainda mais alto em jogos de rivalidade ou decisivos.',
  home_bias: 'Inclina as marcações de falta até ±8% a favor de quem joga em casa — um árbitro que (consciente ou não) facilita à equipa da casa.',
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1.5 cursor-help align-middle">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full flex-shrink-0 text-xs font-bold" style={{ background: '#cec7bc', color: '#5c554e', lineHeight: 1, fontSize: 9 }}>i</span>
      <span className="absolute left-0 top-full mt-1 z-50 px-2.5 py-2 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" style={{ background: '#1a1512', color: '#f5f1eb', width: 240, whiteSpace: 'normal', lineHeight: 1.5, fontWeight: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>{text}</span>
    </span>
  )
}

function TraitBar({ value, color }: { value: number, color: string }) {
  return (
    <div style={{ width: 100, height: 8, borderRadius: 4, background: '#e8e2d6', overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 4 }} />
    </div>
  )
}

export default function RefereeProfilePage({ params }: { params: { id: string } }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [loading, setLoading] = useState(true)
  const [referee, setReferee] = useState<any>(null)
  const [games, setGames] = useState<any[]>([])
  const [teamMap, setTeamMap] = useState<Record<string, any>>({})

  useEffect(() => {
    (async () => {
      const { data: ref } = await supabase.from('referees').select('*').eq('id', params.id).single()
      setReferee(ref)
      if (!ref) { setLoading(false); return }

      // No declared foreign key from games.referee_id to referees — fetch
      // games separately rather than risk an embedded-join 400.
      const { data: gamesData } = await supabase.from('games')
        .select('id,home_team,away_team,home_score,away_score,status,played_at,week_number,referee_rating')
        .eq('referee_id', params.id)
        .order('played_at', { ascending: false })
      setGames(gamesData || [])

      const teamIds = Array.from(new Set((gamesData || []).flatMap((g: any) => [g.home_team, g.away_team])))
      if (teamIds.length) {
        const { data: teams } = await supabase.from('teams').select('id,name,logo_url').in('id', teamIds)
        const map: Record<string, any> = {}
        ;(teams || []).forEach((tm: any) => { map[tm.id] = tm })
        setTeamMap(map)
      }
      setLoading(false)
    })()
  }, [params.id])

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-12 text-center" style={{ color: '#8a8279' }}>{t('common.loading')}</div>

  if (!referee) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-sm" style={{ color: '#8a8279' }}>{isPT ? 'Árbitro não encontrado.' : 'Referee not found.'}</p>
      </div>
    )
  }

  const played = games.filter((g: any) => g.status === 'final')
  const upcoming = games.filter((g: any) => g.status !== 'final')
  const traitLabel = (tm: typeof REFEREE_TRAIT_META[number]) => isPT ? tm.labelPT : tm.labelEN
  const TRAIT_TIPS = isPT ? TRAIT_TIPS_PT : TRAIT_TIPS_EN
  const ratedGames = played.filter((g: any) => g.referee_rating != null)
  const avgRating = ratedGames.length ? ratedGames.reduce((s: number, g: any) => s + g.referee_rating, 0) / ratedGames.length : null
  const ratingColor = (v: number) => v >= 8 ? '#15803d' : v >= 6.5 ? '#1a1512' : v >= 5 ? '#b45309' : '#dc2626'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/" className="text-xs no-underline mb-6 block" style={{ color: '#8a8279' }}>← {isPT ? 'Início' : 'Home'}</Link>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0" style={{ background: '#e8e2d6' }}>
          {referee.photo_url
            ? <img src={referee.photo_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-xl font-black" style={{ color: '#8a8279' }}>
                {referee.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </div>}
        </div>
        <div>
          <h1 className="text-xl font-black" style={{ color: '#1a1512' }}>👨‍⚖️ {referee.name}</h1>
          <p className="text-xs" style={{ color: '#8a8279' }}>
            {played.length} {isPT ? 'jogo(s) apitado(s) esta época' : 'game(s) officiated this season'}
          </p>
        </div>
        {avgRating != null && (
          <div className="ml-auto text-center flex-shrink-0">
            <div className="text-2xl font-black" style={{ color: ratingColor(avgRating) }}>{avgRating.toFixed(1)}</div>
            <div className="text-xs" style={{ color: '#8a8279' }}>{isPT ? 'média (júri)' : 'avg (jury)'}</div>
          </div>
        )}
      </div>

      <div className="rounded-xl p-4 mb-6 flex flex-col gap-3" style={{ background: '#faf8f5', border: '1px solid #d4cdc5' }}>
        {REFEREE_TRAIT_META.map(tm => (
          <div key={tm.key} className="flex items-center gap-3">
            <span className="text-xs w-40 flex-shrink-0 flex items-center" style={{ color: '#5c554e' }}>{traitLabel(tm)}<Tooltip text={TRAIT_TIPS[tm.key]} /></span>
            <TraitBar value={referee[tm.key]} color={tm.color} />
            <span className="text-xs font-bold" style={{ color: '#1a1512' }}>{referee[tm.key]}</span>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#8a8279' }}>
        {isPT ? 'Jogos Apitados' : 'Games Officiated'}
      </h2>
      <div className="flex flex-col gap-1.5">
        {played.map((g: any) => {
          const home = teamMap[g.home_team], away = teamMap[g.away_team]
          return (
            <Link key={g.id} href={`/game/${g.id}`} className="flex items-center gap-3 px-3 py-2 rounded-lg no-underline" style={{ background: '#faf8f5', border: '1px solid #e2dcd5' }}>
              <span className="text-xs w-16 flex-shrink-0" style={{ color: '#8a8279' }}>{isPT ? 'Sem' : 'Wk'} {g.week_number}</span>
              <span className="text-sm flex-1" style={{ color: '#1a1512' }}>{home?.name || g.home_team} vs {away?.name || g.away_team}</span>
              <span className="text-sm font-bold" style={{ color: '#1a1512' }}>{g.home_score}-{g.away_score}</span>
              {g.referee_rating != null && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: ratingColor(g.referee_rating), background: ratingColor(g.referee_rating) + '18' }}>{g.referee_rating.toFixed(1)}</span>
              )}
            </Link>
          )
        })}
        {upcoming.slice(0, 5).map((g: any) => {
          const home = teamMap[g.home_team], away = teamMap[g.away_team]
          return (
            <div key={g.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: '#f5f1eb', border: '1px solid #e2dcd5' }}>
              <span className="text-xs w-16 flex-shrink-0" style={{ color: '#8a8279' }}>{isPT ? 'Sem' : 'Wk'} {g.week_number}</span>
              <span className="text-sm flex-1" style={{ color: '#1a1512' }}>{home?.name || g.home_team} vs {away?.name || g.away_team}</span>
              <span className="text-xs" style={{ color: '#8a8279' }}>{isPT ? 'Agendado' : 'Scheduled'}</span>
            </div>
          )
        })}
      </div>

      {!games.length && (
        <div className="rounded-xl p-6 text-center" style={{ background: '#e8e2d6', border: '1px solid #d4cdc5' }}>
          <p className="text-sm" style={{ color: '#6b5f4e' }}>{isPT ? 'Ainda sem jogos atribuídos.' : 'No games assigned yet.'}</p>
        </div>
      )}
    </div>
  )
}
