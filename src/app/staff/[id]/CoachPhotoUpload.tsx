'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

// Same upload pattern as ProspectPhotoUpload.tsx (the only other photo
// upload in the app) — coaches.photo_url previously had no in-app way to
// set it at all, only hardcoded external URLs from a generation script.
export default function CoachPhotoUpload({ coachId, currentPhoto }: { coachId: string, currentPhoto?: string }) {
  const { profile } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Only commissioner can upload
  if (profile?.role !== 'commissioner') return null

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMsg('')
    try {
      const ext = file.name.split('.').pop()
      const path = `coaches/${coachId}.${ext}`
      const { error: upErr } = await supabase.storage.from('players').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('players').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('coaches').update({ photo_url: publicUrl }).eq('id', coachId)
      if (dbErr) throw dbErr
      setMsg('✓ Photo updated')
      setTimeout(() => window.location.reload(), 800)
    } catch (err: any) {
      setMsg('Error: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload}/>
      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg w-full text-center"
        style={{background:'#1d4ed8',color:'#fff',opacity:uploading?0.6:1}}>
        {uploading ? 'Uploading...' : currentPhoto ? '📷 Change Photo' : '📷 Upload Photo'}
      </button>
      {msg && <span className="text-xs" style={{color:msg.startsWith('✓')?'#15803d':'#dc2626'}}>{msg}</span>}
    </div>
  )
}
