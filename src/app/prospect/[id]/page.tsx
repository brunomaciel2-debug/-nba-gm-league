import ProspectPageClient from './ProspectPageClient'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function ProspectPage({ params }: { params: { id: string } }) {
  return <ProspectPageClient prospectId={params.id}/>
}
