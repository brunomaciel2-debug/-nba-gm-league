'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

export default function DraftClassUploadPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [season, setSeason] = useState('')
  const [fileName, setFileName] = useState('')
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ count: number } | null>(null)
  const [error, setError] = useState('')
  const [details, setDetails] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const downloadTemplate = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/admin/draft-class/template', {
      headers: { 'Authorization': 'Bearer ' + session.access_token },
    })
    if (!res.ok) { setError(isPT ? 'Não foi possível obter o template.' : 'Could not download the template.'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'draft_class_template.csv'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError(''); setDetails([]); setResult(null)
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result || ''))
    reader.readAsText(file)
  }

  const upload = async () => {
    if (!season.trim()) { setError(isPT ? 'Indica a época da Draft Class (ex: "2027").' : 'Enter the Draft Class season (e.g. "2027").'); return }
    if (!csvText) { setError(isPT ? 'Escolhe primeiro um ficheiro CSV.' : 'Choose a CSV file first.'); return }
    setLoading(true); setError(''); setDetails([]); setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError(isPT ? 'Não autenticado.' : 'Not authenticated.'); setLoading(false); return }
      const res = await fetch('/api/admin/draft-class/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
        body: JSON.stringify({ season: season.trim(), csv: csvText }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || (isPT ? 'Erro desconhecido' : 'Unknown error'))
        setDetails(data.details || [])
      } else {
        setResult({ count: data.count })
        setCsvText(''); setFileName('')
        if (fileInput.current) fileInput.current.value = ''
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link href="/admin" className="text-xs no-underline mb-6 block" style={{color:'#8a8279'}}>← Admin</Link>

      <h1 className="text-xl font-bold mb-2" style={{color:'#1a1512'}}>
        🎓 {isPT ? 'Carregar Draft Class' : 'Upload Draft Class'}
      </h1>
      <p className="text-sm mb-6" style={{color:'#5c554e'}}>
        {isPT
          ? 'Carrega os prospects da próxima época a partir de um ficheiro CSV. Descarrega o template, preenche uma linha por prospect com a tua avaliação de scout (posição, idade e 6 categorias de 0-100), e faz upload — o motor do jogo expande automaticamente cada linha nos atributos completos.'
          : "Upload next season's prospects from a CSV file. Download the template, fill in one row per prospect with your scouting grades (position, age, and 6 categories from 0-100), and upload it — the game engine automatically expands each row into full attributes."}
      </p>

      <button
        onClick={downloadTemplate}
        className="w-full py-3 rounded-xl font-bold text-sm mb-4"
        style={{background:'#e8e2d6', color:'#1a1512', border:'1px solid #d4cec3'}}>
        📥 {isPT ? 'Descarregar Template CSV' : 'Download CSV Template'}
      </button>

      <label className="block text-xs font-semibold mb-1" style={{color:'#5c554e'}}>
        {isPT ? 'Época da Draft Class (ex: 2027)' : 'Draft Class season (e.g. 2027)'}
      </label>
      <input
        type="text" value={season} onChange={e=>setSeason(e.target.value)}
        placeholder="2027"
        className="w-full px-4 py-3 rounded-xl text-sm mb-4"
        style={{background:'#ddd7ca', border:'1px solid #d4cec3', outline:'none', color:'#1a1512'}}/>

      <label className="block text-xs font-semibold mb-1" style={{color:'#5c554e'}}>
        {isPT ? 'Ficheiro CSV preenchido' : 'Filled-in CSV file'}
      </label>
      <input
        ref={fileInput} type="file" accept=".csv,text/csv" onChange={onFileChange}
        className="w-full text-sm mb-1" style={{color:'#1a1512'}}/>
      {fileName && <p className="text-xs mb-4" style={{color:'#6b5f4e'}}>{isPT ? 'Selecionado' : 'Selected'}: {fileName}</p>}

      <button
        onClick={upload}
        disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 mb-4"
        style={{background:'#c8102e', color:'#fff'}}>
        {loading
          ? (isPT ? '⏳ A carregar...' : '⏳ Uploading...')
          : `🚀 ${isPT ? 'Carregar Draft Class' : 'Upload Draft Class'}`}
      </button>

      {error && (
        <div className="rounded-xl p-4 mb-4" style={{background:'#fee2e2', border:'1px solid #dc2626'}}>
          <p className="text-sm font-bold" style={{color:'#dc2626'}}>❌ {error}</p>
          {details.length > 0 && (
            <ul className="text-xs mt-2 space-y-1" style={{color:'#991b1b'}}>
              {details.map((d, i) => <li key={i}>• {d}</li>)}
            </ul>
          )}
        </div>
      )}

      {result && (
        <div className="rounded-xl p-4" style={{background:'#dcfce7', border:'1px solid #15803d'}}>
          <p className="text-sm font-bold" style={{color:'#15803d'}}>
            {isPT ? 'Draft Class carregada!' : 'Draft Class uploaded!'}
          </p>
          <p className="text-xs mt-1" style={{color:'#166534'}}>
            {result.count} {isPT ? 'prospects adicionados. A época da próxima Draft foi atualizada automaticamente.' : 'prospects added. Next Draft season updated automatically.'}
          </p>
        </div>
      )}
    </div>
  )
}
