'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'

export default function AdminPage() {
  const { profile } = useAuth()
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')
  // Live counts for every item that's actually a queue of decisions only
  // the Commissioner can make (as opposed to a one-off tool or a batch
  // trigger for something GMs already decided) — surfaced as a "!" badge
  // per Bruno's request, so the panel itself flags what's waiting on him
  // instead of him having to open every page to find out.
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    Promise.all([
      supabase.from('trade_proposals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('preseason_games').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('home_type', 'nba').eq('away_type', 'nba'),
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('retirement_decisions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]).then(([trades, friendlies, applications, retirements]) => {
      setCounts({
        trades: trades.count || 0,
        friendlies: friendlies.count || 0,
        applications: applications.count || 0,
        retirements: retirements.count || 0,
      })
    })
  }, [])

  const isCommissioner = profile?.role === 'commissioner'
  const login = () => {
    if (secret.length >= 6) { setAuthed(true); setError('') }
    else setError(isPT ? 'Palavra-passe incorrecta.' : 'Incorrect password.')
  }

  if (!isCommissioner && !authed) return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="rounded-2xl p-8" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
        <div className="text-4xl mb-4 text-center">🏀</div>
        <h1 className="text-xl font-bold mb-2 text-center" style={{color:'#1a1512'}}>
          {isPT ? 'Login do Comissário' : 'Commissioner Login'}
        </h1>
        <p className="text-sm mb-6 text-center" style={{color:'#6b5f4e'}}>
          {isPT ? 'Introduz a tua palavra-passe de comissário.' : 'Enter your commissioner password.'}
        </p>
        <input type="password" value={secret} onChange={e=>setSecret(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&login()}
          placeholder={isPT ? 'Palavra-passe do comissário' : 'Commissioner password'}
          className="w-full px-4 py-3 rounded-xl text-sm mb-3"
          style={{background:'#ddd7ca',border:'1px solid #d4cec3',outline:'none',color:'#1a1512'}}/>
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <button onClick={login} className="w-full py-3 rounded-xl font-bold text-sm"
          style={{background:'#d4cdc5',color:'#1e40af'}}>
          {isPT ? 'Entrar no Painel →' : 'Enter Admin Panel →'}
        </button>
      </div>
    </div>
  )

  const items_EN = [
    {icon:'⚡',label:'Simulate Games',    desc:'Manually trigger simulation — a day, a week, or several weeks at once', href:'/admin/simulate', color:'#15803d'},
    {icon:'✍️',label:'Write Article',     desc:'Publish news, recaps, analysis',               href:'/admin/article/new', color:'#1d4ed8'},
    {icon:'📋',label:'Manage Articles',   desc:'Edit, publish, delete articles',                href:'/admin/articles',    color:'#1e40af'},
    {icon:'🖼️',label:'Media Manager',     desc:'Upload team logos & player photos',             href:'/admin/media',       color:'#0e7490'},
    {icon:'🤝',label:'Trade Approvals',   desc:'Review pending trade proposals',                href:'/admin/trades',      color:'#c2410c', badgeKey:'trades'},
    {icon:'📅',label:'Friendly Approvals', desc:'Accept/decline pre-season friendly requests',  href:'/preseason',         color:'#4338ca', badgeKey:'friendlies'},
    {icon:'🏥',label:'Injury Report',     desc:'Add/update player injuries',                    href:'/admin/injuries',    color:'#dc2626'},
    {icon:'👥',label:'Manage GMs',        desc:'Assign GMs to teams, send invites',             href:'/admin/gms',         color:'#166534'},
    {icon:'🏆',label:'Generate Playoffs', desc:'Create play-in and playoff bracket after Week 40', href:'/admin/playoffs', color:'#c8102e'},
    {icon:'📋',label:'GM Applications',   desc:'Review and approve GM job applications',        href:'/admin/applications',color:'#166534', badgeKey:'applications'},
    {icon:'🎯',label:'Coaching Staff',    desc:'View all coaches, free agents',                 href:'/admin/coaches',     color:'#b45309'},
    {icon:'🤝',label:'Sponsor Pool',      desc:'Generate sponsor options for every team',       href:'/admin/sponsor-pool',color:'#0e7490'},
    {icon:'📅',label:'Generate Schedule', desc:'Rebuild the full 82-game Regular Season calendar', href:'/admin/generate-schedule', color:'#4338ca'},
    {icon:'👔',label:'Resolve Staff Offers', desc:'Decide pending free-agent coach offers',        href:'/admin/resolve-staff-offers', color:'#1d4ed8'},
    {icon:'🏀',label:'Resolve Free Agency', desc:'Decide Free Agency week contract offers',        href:'/admin/resolve-free-agency', color:'#c8102e'},
    {icon:'🎓',label:'Resolve Draft',       desc:'Run Round 1 / Round 2 of the Draft',            href:'/admin/resolve-draft',       color:'#7c3aed'},
    {icon:'📤',label:'Upload Draft Class', desc:'Provide next season\'s prospects via CSV',      href:'/admin/draft-class', color:'#0e7490'},
    {icon:'🏀',label:'Retirement Decisions', desc:'Decide which 35+ veterans stay or retire',     href:'/admin/retirements', color:'#b45309', badgeKey:'retirements'},
  ]
  const items_PT = [
    {icon:'⚡',label:'Simular Jogos',      desc:'Disparar simulação — um dia, uma semana, ou várias semanas de uma vez', href:'/admin/simulate', color:'#15803d'},
    {icon:'✍️',label:'Escrever Artigo',    desc:'Publicar notícias, resumos, análises',         href:'/admin/article/new', color:'#1d4ed8'},
    {icon:'📋',label:'Gerir Artigos',      desc:'Editar, publicar, eliminar artigos',            href:'/admin/articles',    color:'#1e40af'},
    {icon:'🖼️',label:'Gestor de Media',    desc:'Carregar logos de equipas e fotos',            href:'/admin/media',       color:'#0e7490'},
    {icon:'🤝',label:'Aprovação de Trades',desc:'Rever propostas de trade pendentes',            href:'/admin/trades',      color:'#c2410c', badgeKey:'trades'},
    {icon:'📅',label:'Aprovação de Amigáveis', desc:'Aceitar/recusar pedidos de jogos amigáveis', href:'/preseason',        color:'#4338ca', badgeKey:'friendlies'},
    {icon:'🏥',label:'Relatório de Lesões',desc:'Adicionar/actualizar lesões de jogadores',     href:'/admin/injuries',    color:'#dc2626'},
    {icon:'👥',label:'Gerir GMs',          desc:'Atribuir GMs a equipas, enviar convites',      href:'/admin/gms',         color:'#166534'},
    {icon:'🏆',label:'Gerar Playoffs',     desc:'Criar o quadro de playoffs após a Semana 40',  href:'/admin/playoffs',    color:'#c8102e'},
    {icon:'📋',label:'Candidaturas GM',    desc:'Rever e aprovar candidaturas a GM',            href:'/admin/applications',color:'#166534', badgeKey:'applications'},
    {icon:'🎯',label:'Staff Técnico',      desc:'Ver todos os treinadores e agentes livres',    href:'/admin/coaches',     color:'#b45309'},
    {icon:'🤝',label:'Reserva Patrocínios',desc:'Gerar opções de patrocínio para as equipas',    href:'/admin/sponsor-pool',color:'#0e7490'},
    {icon:'📅',label:'Gerar Calendário',   desc:'Reconstruir o calendário completo de 82 jogos',href:'/admin/generate-schedule',color:'#4338ca'},
    {icon:'👔',label:'Resolver Propostas de Staff', desc:'Decidir propostas pendentes a treinadores livres', href:'/admin/resolve-staff-offers', color:'#1d4ed8'},
    {icon:'🏀',label:'Resolver Free Agency', desc:'Decidir propostas de contrato da semana de Free Agency', href:'/admin/resolve-free-agency', color:'#c8102e'},
    {icon:'🎓',label:'Resolver Draft',       desc:'Correr a Ronda 1 / Ronda 2 do Draft',            href:'/admin/resolve-draft',       color:'#7c3aed'},
    {icon:'📤',label:'Carregar Draft Class', desc:'Fornecer os prospects da próxima época via CSV', href:'/admin/draft-class', color:'#0e7490'},
    {icon:'🏀',label:'Decisões de Retirada', desc:'Decidir quais os veteranos 35+ que ficam ou se retiram', href:'/admin/retirements', color:'#b45309', badgeKey:'retirements'},
  ]
  const items = isPT ? items_PT : items_EN

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1a1512'}}>
            {isPT ? 'Painel do Comissário' : 'Commissioner Panel'}
          </h1>
          <p className="text-sm" style={{color:'#6b5f4e'}}>
            {isPT ? 'Gerir a liga.' : 'Manage the league.'}
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{background:'#15803d',color:'#fff'}}>
          ● NBA GM League 2025-26
        </span>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {items.map(item=>{
          const pending = (item as any).badgeKey ? (counts[(item as any).badgeKey] || 0) : 0
          return (
          <Link key={item.href} href={item.href} className="no-underline group">
            <div className="relative rounded-xl p-5 h-full transition-all"
                 style={{background:'#e8e2d6',border:'1px solid #d4cec3',borderLeft:'3px solid '+item.color}}>
              {pending > 0 && (
                <span className="absolute flex items-center gap-1 rounded-full font-bold"
                      style={{top:10,right:10,padding:'2px 8px',fontSize:11,background:'#dc2626',color:'#fff'}}>
                  ❗ {pending}
                </span>
              )}
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="font-semibold mb-1 transition-colors" style={{color:'#1a1512'}}>{item.label}</div>
              <div className="text-xs" style={{color:'#6b5f4e'}}>{item.desc}</div>
            </div>
          </Link>
          )
        })}
      </div>
    </div>
  )
}
