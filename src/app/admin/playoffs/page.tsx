'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

export default function AdminPlayoffsPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<any>(null)

  const generate = async () => {
    const confirmMsg = isPT
      ? 'Isto irá gerar o quadro de playoffs com base na classificação actual. Continuar?'
      : 'This will generate the playoff bracket based on current standings. Continue?'
    if (!confirm(confirmMsg)) return
    setLoading(true)
    const res = await fetch('/api/playoffs/generate',{method:'POST'})
    const data = await res.json()
    setResult(data); setLoading(false)
  }

  const items_EN = [
    'Play-In: Game A (7v8) — both conferences',
    'Play-In: Game B (9v10) — both conferences',
    'Play-In: Game C (loser A vs winner B) — both conferences',
    'Round 1: 4 series × 2 conferences (best of 7)',
    'Conference Semis: 2 series × 2 conferences (best of 7)',
    'Conference Finals: 1 × 2 conferences (best of 7)',
    'NBA Finals: best of 7',
  ]
  const items_PT = [
    'Play-In: Jogo A (7vs8) — ambas as conferências',
    'Play-In: Jogo B (9vs10) — ambas as conferências',
    'Play-In: Jogo C (perdedor A vs vencedor B) — ambas as conferências',
    'Ronda 1: 4 séries × 2 conferências (melhor de 7)',
    'Meias-Finais de Conferência: 2 séries × 2 conferências (melhor de 7)',
    'Finais de Conferência: 1 × 2 conferências (melhor de 7)',
    'Finais NBA: melhor de 7',
  ]
  const items = isPT ? items_PT : items_EN

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link href="/admin" className="text-xs no-underline mb-6 block" style={{color:'#8a8279'}}>← Admin</Link>
      <h1 className="text-xl font-bold mb-2" style={{color:'#1a1512'}}>
        🏆 {isPT?'Gerar Quadro de Playoffs':'Generate Playoff Bracket'}
      </h1>
      <p className="text-sm mb-6" style={{color:'#5c554e'}}>
        {isPT
          ? 'Executa isto após a Semana 40 (fim da época regular). Criará o Play-In e o quadro de Playoffs com base na classificação actual.'
          : 'Run this after Week 40 (end of regular season). This will create the Play-In and Playoff bracket based on the current standings.'}
      </p>
      <div className="rounded-xl p-5 mb-6" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e'}}>
          {isPT?'O que é criado:':'What gets created:'}
        </div>
        <div className="flex flex-col gap-2 text-sm" style={{color:'#3d3731'}}>
          {items.map((item,i)=>(
            <div key={i} className="flex items-center gap-2">
              <i className="ti ti-check" style={{fontSize:14,color:'#15803d'}}></i>
              {item}
            </div>
          ))}
        </div>
      </div>
      <button onClick={generate} disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
        style={{background:'#c8102e',color:'#fff'}}>
        {loading?(isPT?'A gerar...':'Generating...'):`🏆 ${isPT?'Gerar Quadro de Playoffs':'Generate Playoff Bracket'}`}
      </button>
      {result&&(
        <div className="mt-4 rounded-xl p-4"
             style={{background:result.error?'#fee2e2':'#dcfce7',border:`1px solid ${result.error?'#dc2626':'#15803d'}`}}>
          {result.error
            ?<p className="text-sm font-semibold" style={{color:'#dc2626'}}>{isPT?'Erro':'Error'}: {result.error}</p>
            :<div>
              <p className="text-sm font-bold" style={{color:'#15803d'}}>✓ {isPT?'Quadro gerado com sucesso!':'Bracket generated successfully!'}</p>
              <p className="text-xs mt-1" style={{color:'#166534'}}>{result.created} {isPT?'séries criadas.':'series created.'}</p>
              <Link href="/playoffs" className="text-xs mt-2 block no-underline font-semibold" style={{color:'#15803d'}}>
                {isPT?'Ver Quadro →':'View Bracket →'}
              </Link>
            </div>}
        </div>
      )}
    </div>
  )
}
