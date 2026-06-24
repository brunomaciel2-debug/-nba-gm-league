import { supabase } from '@/lib/supabase'
import ProspectPhotoUpload from './ProspectPhotoUpload'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const ATTR_TIPS: Record<string,string> = {
  three:'Three Point — shooting ability from beyond the arc.',
  layup:'Layup — finishing ability at the rim.',
  dunk:'Dunk — ability to finish with power above the rim.',
  mid:'Mid-Range — ability to score from mid-range.',
  ft:'Free Throws — free throw shooting accuracy.',
  siq:'Shot IQ — decision-making on shot selection.',
  draw_foul:'Draw Foul — ability to get to the free throw line.',
  blk:'Block — ability to block opponent shots.',
  stl:'Steal — ability to strip the ball or intercept passes.',
  idef:'Interior Defense — ability to defend in the paint.',
  pdef:'Perimeter Defense — ability to guard on the perimeter.',
  def_reb:'Defensive Rebound — ability to secure rebounds after misses.',
  off_reb:'Offensive Rebound — ability to recover missed shots offensively.',
  stamina:'Stamina — endurance across a game.',
  durability:'Durability — resistance to injuries.',
  ball_hdl:'Ball Handling — ability to dribble under pressure.',
  pass_vis:'Pass Vision — ability to read the defence and find open teammates.',
  pass_iq:'Pass IQ — decision-making when passing.',
  assist_role:'Assist Role — how naturally this player fits into a pass-first role.',
  pressure:'Clutch/Pressure — performance in high-pressure moments.',
  consistency:'Consistency — game-to-game variance in performance.',
  crowd_effect:'Crowd Effect — how much crowd noise affects this player.',
  streaky:'Streaky — tendency to have hot and cold streaks.',
}

const ATTR_GROUPS = [
  { label: 'Scoring',       color: '#b45309', attrs: [
    {key:'three',label:'Three Point'},{key:'layup',label:'Layup'},
    {key:'dunk',label:'Dunk'},{key:'mid',label:'Mid-Range'},
    {key:'ft',label:'Free Throws'},{key:'siq',label:'Shot IQ'},
    {key:'draw_foul',label:'Draw Foul'},
  ]},
  { label: 'Defense',       color: '#15803d', attrs: [
    {key:'blk',label:'Block'},{key:'stl',label:'Steal'},
    {key:'idef',label:'Interior Defense'},{key:'pdef',label:'Perimeter Defense'},
  ]},
  { label: 'Rebounding',    color: '#1d4ed8', attrs: [
    {key:'def_reb',label:'Def. Rebound'},{key:'off_reb',label:'Off. Rebound'},
  ]},
  { label: 'Athleticism',   color: '#6d28d9', attrs: [
    {key:'stamina',label:'Stamina'},{key:'durability',label:'Durability'},
  ]},
  { label: 'Playmaking',    color: '#0e7490', attrs: [
    {key:'ball_hdl',label:'Ball Handle'},{key:'pass_vis',label:'Pass Vision'},
    {key:'pass_iq',label:'Pass IQ'},{key:'assist_role',label:'Assist Role'},
  ]},
  { label: 'Psychological', color: '#b45309', attrs: [
    {key:'pressure',label:'Clutch/Pressure'},{key:'consistency',label:'Consistency'},
    {key:'crowd_effect',label:'Crowd Effect'},{key:'streaky',label:'Streaky'},
  ]},
]

const POS_COLOR: Record<string,string> = {
  PG:'#1d4ed8', SG:'#6d28d9', SF:'#15803d', PF:'#b45309', C:'#dc2626',
}

function AttrTooltip({ tip }: { tip: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help align-middle">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-xs font-bold flex-shrink-0"
            style={{background:'#d4cdc5',color:'#5c554e',lineHeight:1,fontSize:9}}>i</span>
      <span className="absolute left-0 top-full mt-1 z-50 px-2.5 py-2 rounded-lg text-xs
                       opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            style={{background:'#1a1512',color:'#f5f1eb',width:220,whiteSpace:'normal',
                    lineHeight:1.5,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>
        {tip}
      </span>
    </span>
  )
}

function AttrBar({ value, color }: { value: number, color: string }) {
  const pct = Math.min(100, Math.max(0, value))
  const barColor = value>=85?'#b45309':value>=70?color:value>=50?color+'99':'#dc2626'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#d4cdc5'}}>
        <div className="h-full rounded-full" style={{width:pct+'%',background:barColor}}></div>
      </div>
      <span className="text-xs font-bold w-7 text-right"
            style={{color:value>=85?'#b45309':value>=70?'#1a1512':value>=50?'#5c554e':'#dc2626'}}>
        {value}
      </span>
    </div>
  )
}

export default async function ProspectPage({ params }: { params: { id: string } }) {
  const { data: prospect } = await supabase
    .from('prospects')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!prospect) return (
    <div className="p-8 text-center" style={{color:'#5c554e'}}>Prospect not found.</div>
  )

  const p = prospect as any
  const posColor = POS_COLOR[p.pos] || '#5c554e'
  const ovrColor = p.overall>=85?'#b45309':p.overall>=75?'#15803d':p.overall>=65?'#1d4ed8':'#5c554e'
  const ovrBg    = p.overall>=85?'#fef3c7':p.overall>=75?'#dcfce7':p.overall>=65?'#dbeafe':'#f0ece5'

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">

      {/* Back link */}
      <a href="/draft" className="inline-flex items-center gap-1.5 text-xs font-semibold mb-4 no-underline"
         style={{color:'#8a8279'}}>
        ← Back to Draft
      </a>

      {/* HEADER */}
      <div className="rounded-2xl p-6 mb-6"
           style={{background:'#faf8f5',borderTop:'4px solid '+posColor,border:'1px solid #d4cdc5'}}>
        <div className="flex gap-5 flex-wrap items-start">
          {/* Photo */}
          <div className="flex-shrink-0 flex flex-col gap-2">
            {p.photo_url
              ? <img src={p.photo_url} alt={p.name} className="w-40 h-40 rounded-xl object-cover"
                     style={{border:'2px solid '+posColor}}/>
              : <div className="w-40 h-40 rounded-xl flex items-center justify-center text-3xl font-black"
                     style={{background:posColor+'18',color:posColor,border:'2px solid '+posColor+'33'}}>
                  {p.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                </div>
            }
            {/* Upload button (client component) */}
            <ProspectPhotoUpload prospectId={p.id} currentPhoto={p.photo_url}/>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1"
                     style={{color:posColor,letterSpacing:'1px'}}>
                  2026-27 Draft Class · {p.pos}
                </div>
                <h1 className="text-3xl font-black mb-2" style={{color:'#1a1512'}}>{p.name}</h1>
                <div className="flex gap-3 text-sm flex-wrap items-center">
                  {p.nationality && <span style={{color:'#5c554e'}}>{p.nationality}</span>}
                  {p.age && <span style={{color:'#5c554e'}}>Age {p.age}</span>}
                  {p.college && <span style={{color:'#5c554e'}}>{p.college}</span>}
                  <span className="text-xs px-2 py-0.5 rounded font-bold"
                        style={{background:posColor+'22',color:posColor}}>{p.pos}</span>
                </div>
              </div>
              {/* OVR — shown to all for now, commissioner only logic in DraftSection */}
              <div className="flex flex-col items-center justify-center rounded-xl p-3 min-w-[60px]"
                   style={{background:ovrBg,border:'1px solid '+ovrColor+'44'}}>
                <span className="text-2xl font-black" style={{color:ovrColor}}>?</span>
                <span className="text-xs font-semibold" style={{color:ovrColor}}>OVR</span>
              </div>
            </div>

            {/* Physical */}
            <div className="flex gap-6 mt-3 flex-wrap">
              {[
                {label:'Height', val:p.height||'—'},
                {label:'Weight', val:p.weight ? p.weight+'lbs' : '—'},
                {label:'Nationality', val:p.nationality||'—'},
                {label:'School', val:p.college||'—'},
              ].map(item => (
                <div key={item.label}>
                  <div className="text-xs" style={{color:'#8a8279'}}>{item.label}</div>
                  <div className="font-bold text-sm" style={{color:'#1a1512'}}>{item.val}</div>
                </div>
              ))}
            </div>

            {/* Notes */}
            {p.notes && (
              <div className="mt-3 text-sm px-3 py-2 rounded-lg"
                   style={{background:'#f0ece5',color:'#5c554e',borderLeft:'3px solid '+posColor}}>
                {p.notes}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ATTRIBUTES */}
      <div className="sec-hdr mb-4">
        <span className="sec-title">Attributes</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {ATTR_GROUPS.map(group => (
          <div key={group.label} className="rounded-xl p-4"
               style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:'2px solid '+group.color}}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3"
                 style={{color:group.color,letterSpacing:'1px'}}>{group.label}</div>
            {group.attrs.map(attr => (
              <div key={attr.key} className="mb-2">
                <div className="text-xs mb-0.5 flex items-center" style={{color:'#5c554e'}}>
                  {attr.label}
                  {ATTR_TIPS[attr.key] && <AttrTooltip tip={ATTR_TIPS[attr.key]}/>}
                </div>
                <AttrBar value={p[attr.key]||0} color={group.color}/>
              </div>
            ))}
          </div>
        ))}
      </div>

    </div>
  )
}
