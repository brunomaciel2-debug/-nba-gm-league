'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

const TYPE_ICONS: Record<string,string> = {
  system:'🤖', application:'📋', preseason_request:'🏀', preseason_accepted:'✅',
  preseason_declined:'❌', injury:'🏥', trade:'🔄', contract:'📝', award:'🏆',
  sponsor:'🎯', results:'📊', standings:'📍', streak:'🔥', rivalry:'⚔️',
  development:'📈', morale:'😟', construction:'🏗️', reminder:'⏰', gleague:'⬆️',
  fa:'👤', training:'🏋️', scouting:'🔍',
}

const TYPE_COLORS: Record<string,string> = {
  injury:'#dc2626', results:'#1d4ed8', standings:'#b45309', streak:'#b45309',
  rivalry:'#7c3aed', development:'#15803d', morale:'#dc2626', construction:'#b45309',
  reminder:'#6b7280', sponsor:'#15803d', award:'#b45309', gleague:'#1d4ed8',
  contract:'#7c3aed', trade:'#1d4ed8', fa:'#15803d', training:'#7c3aed', scouting:'#0e7490',
}

const TYPE_LABELS_PT: Record<string,string> = {
  all:'Todos', unread:'Não Lidos', injury:'Lesões', results:'Resultados', standings:'Classificação',
  streak:'Séries', rivalry:'Rivalidade', development:'Desenvolvimento', morale:'Moral',
  construction:'Construção', reminder:'Lembretes', sponsor:'Patrocínio', award:'Prémios',
  gleague:'G-League', contract:'Contratos', trade:'Trades', fa:'Free Agency',
  training:'Treino', scouting:'Scouting', application:'Candidaturas',
}

export default function InboxPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [messages, setMessages] = useState<any[]>([])
  const [myTeamId, setMyTeamId] = useState<string|null>(null)
  const [isCommissioner, setIsCommissioner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<string|null>(null)
  const [processing, setProcessing] = useState<string|null>(null)
  const [actionMsg, setActionMsg] = useState('')

  const loadMessages = async (tid: string) => {
    const { data } = await supabase.from('inbox_messages').select('*').eq('to_team_id', tid)
      .order('created_at',{ascending:false}).limit(200)
    setMessages(data||[])
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data: gm } = await supabase.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
      if (!gm) { setLoading(false); return }
      const tid = gm.role==='commissioner' ? 'commissioner' : gm.team_id
      if (!tid) { setLoading(false); return }
      setMyTeamId(tid); setIsCommissioner(gm.role==='commissioner')
      await loadMessages(tid); setLoading(false)
    })
  }, [])

  const markAsRead = async (msg: any) => {
    if (msg.read) return
    await supabase.from('inbox_messages').update({read:true}).eq('id',msg.id)
    setMessages(prev=>prev.map(m=>m.id===msg.id?{...m,read:true}:m))
  }

  const toggleExpand = async (msg: any) => {
    if (expanded===msg.id) { setExpanded(null) }
    else { setExpanded(msg.id); await markAsRead(msg) }
  }

  const deleteMsg = async (id: string) => {
    await supabase.from('inbox_messages').delete().eq('id',id)
    setMessages(prev=>prev.filter(m=>m.id!==id))
    if (expanded===id) setExpanded(null)
  }

  const clearRead = async () => {
    if (!myTeamId) return
    await supabase.from('inbox_messages').delete().eq('to_team_id',myTeamId).eq('read',true)
    setMessages(prev=>prev.filter(m=>!m.read))
  }

  const approveApp = async (msg: any) => {
    if (!msg.metadata?.application_id) return
    setProcessing(msg.id)
    try {
      const res = await fetch('/api/admin/approve-gm', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({application_id:msg.metadata.application_id,email:msg.metadata.email,
          password:msg.metadata.password||'NBA2025!',full_name:msg.metadata.full_name,team_id:msg.metadata.team_id}),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error||'Unknown error')
      setActionMsg(`✅ ${msg.metadata.full_name} ${isPT?'aprovado':'approved'}!`)
      await deleteMsg(msg.id)
    } catch (e:any) { setActionMsg(`❌ ${isPT?'Erro':'Error'}: ${e.message}`) }
    setProcessing(null)
  }

  const seeSpecialist = async (msg: any) => {
    if (!msg.metadata?.player_id) return
    setProcessing(msg.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error(isPT?'Não estás autenticado':'Not logged in')
      const res = await fetch('/api/players/see-specialist', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
        body:JSON.stringify({ playerId: msg.metadata.player_id }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error||'Unknown error')
      setActionMsg(`✅ ${isPT?'Especialista consultado! Nova saúde':'Specialist consulted! New health'}: ${result.newHealth}%`)
      const newMeta = { ...msg.metadata, specialist_used:true }
      await supabase.from('inbox_messages').update({ metadata:newMeta }).eq('id',msg.id)
      setMessages(prev=>prev.map(m=>m.id===msg.id?{...m,metadata:newMeta}:m))
    } catch (e:any) { setActionMsg(`❌ ${isPT?'Erro':'Error'}: ${e.message}`) }
    setProcessing(null)
  }

  const rejectApp = async (msg: any) => {
    if (!msg.metadata?.application_id) return
    setProcessing(msg.id)
    try {
      const res = await fetch('/api/admin/approve-gm', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'reject',application_id:msg.metadata.application_id,
          email:msg.metadata.email,full_name:msg.metadata.full_name}),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error||'Unknown error')
      setActionMsg(`❌ ${msg.metadata.full_name} ${isPT?'rejeitado':'rejected'}.`)
      await deleteMsg(msg.id)
    } catch (e:any) { setActionMsg(`❌ ${isPT?'Erro':'Error'}: ${e.message}`) }
    setProcessing(null)
  }

  const typeSet: Record<string,boolean> = {}
  messages.forEach(m => { if(m.type) typeSet[m.type]=true })
  const types = Object.keys(typeSet)
  const unreadCount = messages.filter(m=>!m.read).length

  const filtered = filter==='unread' ? messages.filter(m=>!m.read)
    : filter==='all' ? messages : messages.filter(m=>m.type===filter)

  const fmtDate = (iso: string) => {
    const d=new Date(iso), now=new Date(), diff=now.getTime()-d.getTime()
    if (diff<60000) return isPT?'Agora mesmo':'Just now'
    if (diff<3600000) return `${Math.floor(diff/60000)}m`
    if (diff<86400000) return `${Math.floor(diff/3600000)}h`
    return d.toLocaleDateString(isPT?'pt-PT':'en-US',{month:'short',day:'numeric'})
  }

  const filterLabel = (f: string) => {
    if (isPT) return TYPE_LABELS_PT[f] || (f.charAt(0).toUpperCase()+f.slice(1))
    if (f==='all') return 'All'
    if (f==='unread') return 'Unread'
    return f.charAt(0).toUpperCase()+f.slice(1)
  }

  if (loading) return <div className="p-8 text-center" style={{color:'#5c554e'}}>{t('common.loading')}</div>

  if (!loading && !myTeamId) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-8 rounded-2xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <div className="text-4xl mb-4">🔒</div>
        <div className="text-xl font-black mb-2" style={{color:'#1a1512'}}>{isPT?'Login Necessário':'Login Required'}</div>
        <a href="/login" className="text-sm font-bold px-4 py-2 rounded-lg"
           style={{background:'#1a1512',color:'#fff',textDecoration:'none'}}>{isPT?'Entrar':'Sign In'}</a>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black mb-0.5" style={{color:'#1a1512'}}>📬 {isPT?'Caixa de Entrada':'Inbox'}</h1>
          <p className="text-sm" style={{color:'#8a8279'}}>
            {messages.length} {isPT?'mensagens':'messages'}{unreadCount>0?` · ${unreadCount} ${isPT?'não lidas':'unread'}`:''}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {messages.filter(m=>m.read).length>0&&(
            <button onClick={clearRead} className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5'}}>
              🗑 {isPT?'Limpar Lidas':'Clear Read'}
            </button>
          )}
        </div>
      </div>

      {actionMsg&&(
        <div className="mb-4 p-3 rounded-lg text-sm font-semibold"
             style={{background:actionMsg.startsWith('✅')?'#dcfce7':'#fee2e2',color:actionMsg.startsWith('✅')?'#15803d':'#dc2626'}}>
          {actionMsg}
        </div>
      )}

      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
        {['all','unread',...types].map(f=>{
          const count=f==='all'?messages.length:f==='unread'?unreadCount:messages.filter(m=>m.type===f).length
          const icon=TYPE_ICONS[f]||'📨'
          const color=TYPE_COLORS[f]||'#1a1512'
          return (
            <button key={f} onClick={()=>setFilter(f)}
              style={{padding:'5px 12px',fontSize:11,fontWeight:600,borderRadius:20,cursor:'pointer',
                border:`1px solid ${filter===f?color:'#d4cdc5'}`,background:filter===f?color:'#f0ece5',
                color:filter===f?'#fff':'#5c554e',display:'flex',alignItems:'center',gap:4}}>
              {f!=='all'&&f!=='unread'&&<span>{icon}</span>}
              {filterLabel(f)}
              <span style={{opacity:0.7}}>({count})</span>
            </button>
          )
        })}
      </div>

      {filtered.length===0?(
        <div className="text-center py-12 rounded-2xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm" style={{color:'#8a8279'}}>
            {filter==='unread'?(isPT?'Nenhuma mensagem não lida':'No unread messages'):(isPT?'Nenhuma mensagem nesta categoria':'No messages in this category')}
          </p>
        </div>
      ):(
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid #c8c0b8',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          {filtered.map((msg,idx)=>{
            const accentColor=TYPE_COLORS[msg.type]||'#c8102e'
            return (
              <div key={msg.id}>
                {idx>0&&<div style={{height:1,background:'#ddd8d0'}}/>}
                <div onClick={()=>toggleExpand(msg)} className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                     style={{background:msg.read?'#f5f2ee':'#ffffff',borderLeft:`3px solid ${msg.read?'transparent':accentColor}`,transition:'background 0.1s'}}
                     onMouseEnter={e=>(e.currentTarget.style.background=msg.read?'#ede8e1':'#fef6f6')}
                     onMouseLeave={e=>(e.currentTarget.style.background=msg.read?'#f5f2ee':'#ffffff')}>
                  <div style={{width:8,height:8,flexShrink:0}}>
                    {!msg.read&&<div style={{width:8,height:8,borderRadius:'50%',background:accentColor}}/>}
                  </div>
                  <div style={{fontSize:18,flexShrink:0,opacity:msg.read?0.45:1}}>{TYPE_ICONS[msg.type]||'📨'}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block" style={{color:msg.read?'#9a9088':'#1a1512',fontWeight:msg.read?400:700}}>
                      {msg.subject}
                    </span>
                    {expanded!==msg.id&&<span className="text-xs truncate block" style={{color:msg.read?'#b0a89e':'#6b5f52'}}>{msg.body?.split('\n')[0]}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs" style={{color:msg.read?'#b0a89e':accentColor,fontWeight:msg.read?400:700}}>{fmtDate(msg.created_at)}</span>
                    <button onClick={e=>{e.stopPropagation();deleteMsg(msg.id)}} className="text-xs px-2 py-1 rounded" style={{background:'transparent',color:'#c0b8b0'}}>🗑</button>
                  </div>
                </div>
                {expanded===msg.id&&(
                  <div style={{background:'#fdfcfb',borderTop:'1px solid #ddd8d0'}}>
                    <div className="px-6 py-4">
                      <p className="text-sm" style={{color:'#2a231e',lineHeight:1.8,whiteSpace:'pre-wrap'}}>{msg.body}</p>
                      {msg.metadata?.game_id&&(
                        <a href={`/game/${msg.metadata.game_id}`}
                           style={{display:'inline-block',marginTop:10,fontSize:12,fontWeight:600,padding:'5px 12px',borderRadius:6,background:'#1d4ed8',color:'#fff',textDecoration:'none'}}>
                          {isPT?'Ver Box Score →':'View Box Score →'}
                        </a>
                      )}
                    </div>
                    {msg.type==='injury'&&msg.metadata?.specialist_eligible&&!msg.metadata?.specialist_used&&(
                      <div className="px-6 py-3 flex items-center gap-3 flex-wrap"
                           style={{background:'#f0ece5',borderTop:'1px solid #ddd8d0'}}>
                        <button onClick={()=>seeSpecialist(msg)} disabled={processing===msg.id}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40 ml-auto"
                          style={{background:'#0e7490',color:'#fff'}}>
                          {processing===msg.id?'⏳...':`🩺 ${isPT?'Ver Especialista':'See a Specialist'} ($${(msg.metadata.specialist_cost/1000).toFixed(0)}K)`}
                        </button>
                      </div>
                    )}
                    {isCommissioner&&msg.type==='application'&&msg.metadata?.application_id&&(
                      <div className="px-6 py-3 flex items-center gap-3 flex-wrap"
                           style={{background:'#f0ece5',borderTop:'1px solid #ddd8d0'}}>
                        <span className="text-xs font-semibold" style={{color:'#5c554e'}}>{msg.metadata.full_name} · {msg.metadata.email}</span>
                        <div className="flex gap-2 ml-auto">
                          <button onClick={()=>approveApp(msg)} disabled={processing===msg.id}
                            className="px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                            style={{background:'#15803d',color:'#fff'}}>
                            {processing===msg.id?'⏳...':`✅ ${isPT?'Aprovar':'Approve'}`}
                          </button>
                          <button onClick={()=>rejectApp(msg)} disabled={processing===msg.id}
                            className="px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                            style={{background:'#dc2626',color:'#fff'}}>
                            {processing===msg.id?'⏳...':`❌ ${isPT?'Rejeitar':'Reject'}`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
