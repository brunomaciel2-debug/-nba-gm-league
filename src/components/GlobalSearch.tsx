'use client'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from './I18nProvider'

type Result = { id: string, label: string, sublabel: string, href: string, icon: string, photo_url?: string | null }

const STAFF_ROLE_LABEL: Record<string, { en: string; pt: string }> = {
  head_coach:            { en: 'Head Coach',            pt: 'Treinador Principal' },
  assistant_coach:       { en: 'Assistant Coach',        pt: 'Treinador Assistente' },
  physio:                { en: 'Physio',                 pt: 'Fisioterapeuta' },
  mental_coach:          { en: 'Mental Coach',           pt: 'Coach Mental' },
  trainer:               { en: 'Trainer',                pt: 'Preparador Físico' },
  scout:                 { en: 'Scout',                  pt: 'Scout' },
  social_media_manager:  { en: 'Social Media Manager',   pt: 'Gestor de Redes Sociais' },
}

// Real teams only — ALL/RVS/ROO/SOP are internal placeholder team_ids used
// elsewhere in the app (draft picks pool, free agent pool, etc.), same
// exclusion every other team listing in the app already applies.
const PLACEHOLDER_TEAM_IDS = '(ALL,RVS,ROO,SOP)'

export default function GlobalSearch({ onNavigate, autoFocus, compact }: { onNavigate?: () => void, autoFocus?: boolean, compact?: boolean }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Club name lookup for player/staff sublabels — fetched once (teams barely
  // change mid-season) rather than re-queried on every keystroke.
  const teamNameById = useRef<Record<string, string>>({})

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    supabase.from('teams').select('id,name').not('id', 'in', PLACEHOLDER_TEAM_IDS).then(({ data }) => {
      const map: Record<string, string> = {}
      for (const tm of data || []) map[tm.id] = tm.name
      teamNameById.current = map
    })
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const query = q.trim()
    if (query.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const [{ data: teams }, { data: players }, { data: coaches }] = await Promise.all([
        supabase.from('teams').select('id,name,logo_url').ilike('name', `%${query}%`).not('id', 'in', PLACEHOLDER_TEAM_IDS).limit(5),
        supabase.from('players').select('id,name,pos,team_id,photo_url').ilike('name', `%${query}%`).limit(6),
        supabase.from('coaches').select('id,name,role,team_id,photo_url').ilike('name', `%${query}%`).limit(5),
      ])
      const clubLabel = (teamId: string | null) => teamId ? (teamNameById.current[teamId] || teamId) : 'FA'
      const teamResults: Result[] = (teams || []).map((tm: any) => ({
        id: `t-${tm.id}`, label: tm.name, sublabel: isPT ? 'Equipa' : 'Team',
        href: `/team/${tm.id}`, icon: 'ti-shirt-sport', photo_url: tm.logo_url,
      }))
      const playerResults: Result[] = (players || []).map((p: any) => ({
        id: `p-${p.id}`, label: p.name, sublabel: clubLabel(p.team_id),
        href: `/player/${p.id}`, icon: 'ti-basketball', photo_url: p.photo_url,
      }))
      const coachResults: Result[] = (coaches || []).map((c: any) => {
        const roleLabel = STAFF_ROLE_LABEL[c.role]
        const role = roleLabel ? (isPT ? roleLabel.pt : roleLabel.en) : c.role
        return {
          id: `c-${c.id}`, label: c.name, sublabel: `${role} · ${clubLabel(c.team_id)}`,
          href: `/staff/${c.id}`, icon: 'ti-whistle', photo_url: c.photo_url,
        }
      })
      setResults([...teamResults, ...playerResults, ...coachResults])
      setLoading(false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, isPT])

  const close = () => { setOpen(false); setQ(''); setResults([]); onNavigate?.() }

  return (
    <div ref={ref} className="relative w-full">
      <div className="flex items-center gap-1.5 rounded-full" style={{ background: '#faf8f5', padding: compact ? '4px 10px' : '7px 14px', minWidth: 0 }}>
        <i className="ti ti-search" style={{ fontSize: compact ? 12 : 14, color: '#8a8279', flexShrink: 0 }}></i>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          autoFocus={autoFocus}
          placeholder={isPT ? 'Equipas, jogadores, staff…' : 'Teams, players, staff…'}
          className="bg-transparent border-none outline-none w-full"
          style={{ color: '#2d2722', fontSize: compact ? 11 : 12 }}
        />
        {q && (
          <button onClick={() => { setQ(''); setResults([]) }} className="flex-shrink-0" style={{ color: '#8a8279' }}>
            <i className="ti ti-x" style={{ fontSize: compact ? 11 : 13 }}></i>
          </button>
        )}
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute right-0 top-full mt-1.5 z-50 rounded-xl overflow-hidden"
             style={{ background: '#ede8df', border: '1px solid #cec8be', width: 300, maxWidth: '90vw',
                      maxHeight: 380, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
          {loading ? (
            <div className="px-4 py-4 text-xs" style={{ color: '#8a8279' }}>{isPT ? 'A procurar…' : 'Searching…'}</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-4 text-xs" style={{ color: '#8a8279' }}>{isPT ? 'Sem resultados.' : 'No results.'}</div>
          ) : (
            <div className="py-1">
              {results.map(r => (
                <Link key={r.id} href={r.href} onClick={close}
                  className="flex items-center gap-3 px-4 py-2 text-xs no-underline transition-all"
                  style={{ color: '#2d2722', borderBottom: '1px solid #d6d0c6' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#e2dbd0')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {r.photo_url ? (
                    <img src={r.photo_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ background: '#d6d0c6' }} />
                  ) : (
                    <i className={`ti ${r.icon}`} style={{ fontSize: 22, color: '#c8102e', width: 40, textAlign: 'center', flexShrink: 0 }}></i>
                  )}
                  <span className="flex-1 min-w-0 truncate font-semibold">{r.label}</span>
                  <span className="flex-shrink-0 text-right" style={{ color: '#8a8279', maxWidth: 130 }}>{r.sublabel}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
