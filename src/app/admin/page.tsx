'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'

export default function AdminPage() {
  const { profile } = useAuth()
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')

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
    {icon:'⚡',label:'Simulate Week',     desc:'Manually trigger next week simulation',         href:'/admin/simulate',    color:'#15803d'},
    {icon:'✍️',label:'Write Article',     desc:'Publish news, recaps, analysis',               href:'/admin/article/new', color:'#1d4ed8'},
    {icon:'📋',label:'Manage Articles',   desc:'Edit, publish, delete articles',                href:'/admin/articles',    color:'#1e40af'},
    {icon:'🖼️',label:'Media Manager',     desc:'Upload team logos & player photos',             href:'/admin/media',       color:'#0e7490'},
    {icon:'🤝',label:'Trade Approvals',   desc:'Review pending trade proposals',                href:'/admin/trades',      color:'#c2410c'},
    {icon:'🏥',label:'Injury Report',     desc:'Add/update player injuries',                    href:'/admin/injuries',    color:'#dc2626'},
    {icon:'👥',label:'Manage GMs',        desc:'Assign GMs to teams, send invites',             href:'/admin/gms',         color:'#166534'},
    {icon:'🏆',label:'Generate Playoffs', desc:'Create play-in and playoff bracket after Week 26', href:'/admin/playoffs', color:'#c8102e'},
    {icon:'📋',label:'GM Applications',   desc:'Review and approve GM job applications',        href:'/admin/applications',color:'#166534'},
    {icon:'🎯',label:'Coaching Staff',    desc:'View all coaches, free agents',                 href:'/admin/coaches',     color:'#b45309'},
    {icon:'🤝',label:'Sponsor Pool',      desc:'Generate sponsor options for every team',       href:'/admin/sponsor-pool',color:'#0e7490'},
  ]
  const items_PT = [
    {icon:'⚡',label:'Simular Semana',     desc:'Disparar simulação da próxima semana',          href:'/admin/simulate',    color:'#15803d'},
    {icon:'✍️',label:'Escrever Artigo',    desc:'Publicar notícias, resumos, análises',         href:'/admin/article/new', color:'#1d4ed8'},
    {icon:'📋',label:'Gerir Artigos',      desc:'Editar, publicar, eliminar artigos',            href:'/admin/articles',    color:'#1e40af'},
    {icon:'🖼️',label:'Gestor de Media',    desc:'Carregar logos de equipas e fotos',            href:'/admin/media',       color:'#0e7490'},
    {icon:'🤝',label:'Aprovação de Trades',desc:'Rever propostas de trade pendentes',            href:'/admin/trades',      color:'#c2410c'},
    {icon:'🏥',label:'Relatório de Lesões',desc:'Adicionar/actualizar lesões de jogadores',     href:'/admin/injuries',    color:'#dc2626'},
    {icon:'👥',label:'Gerir GMs',          desc:'Atribuir GMs a equipas, enviar convites',      href:'/admin/gms',         color:'#166534'},
    {icon:'🏆',label:'Gerar Playoffs',     desc:'Criar o quadro de playoffs após a Semana 26',  href:'/admin/playoffs',    color:'#c8102e'},
    {icon:'📋',label:'Candidaturas GM',    desc:'Rever e aprovar candidaturas a GM',            href:'/admin/applications',color:'#166534'},
    {icon:'🎯',label:'Staff Técnico',      desc:'Ver todos os treinadores e agentes livres',    href:'/admin/coaches',     color:'#b45309'},
    {icon:'🤝',label:'Reserva Patrocínios',desc:'Gerar opções de patrocínio para as equipas',    href:'/admin/sponsor-pool',color:'#0e7490'},
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
        {items.map(item=>(
          <Link key={item.href} href={item.href} className="no-underline group">
            <div className="rounded-xl p-5 h-full transition-all"
                 style={{background:'#e8e2d6',border:'1px solid #d4cec3',borderLeft:'3px solid '+item.color}}>
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="font-semibold mb-1 transition-colors" style={{color:'#1a1512'}}>{item.label}</div>
              <div className="text-xs" style={{color:'#6b5f4e'}}>{item.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
