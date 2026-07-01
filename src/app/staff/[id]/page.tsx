import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
import StaffPageClient from './StaffPageClient'
export const revalidate = 0

export default async function StaffPage({ params }: { params: { id: string } }) {
  const { data: coach } = await supabase.from('coaches').select('*').eq('id', params.id).single()
  if (!coach) notFound()
  const { data: team } = coach.team_id
    ? await supabase.from('teams').select('*').eq('id', coach.team_id).single()
    : { data: null }
  return <StaffPageClient coach={coach} team={team} />
}
