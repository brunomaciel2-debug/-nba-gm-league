import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    const { data: teams } = await supabaseAdmin
      .from('teams').select('*').not('id','in','(ALL,RVS,ROO,SOP)')

    const sort = (arr: any[]) => [...arr].sort((a,b) =>
      (b.wins/(b.wins+b.losses||1)) - (a.wins/(a.wins+a.losses||1)) || b.wins - a.wins
    )

    const east = sort((teams||[]).filter((t:any) => t.conference==='Eastern'))
    const west = sort((teams||[]).filter((t:any) => t.conference==='Western'))
    const series: any[] = []

    for (const [conf, ranked] of [['Eastern',east],['Western',west]] as [string,any[]][]) {
      const c = conf.toLowerCase()
      const [t1,t2,t3,t4,t5,t6,t7,t8,t9,t10] = ranked

      // Play-In: A = 7v8, B = 9v10, C = loser(A) vs winner(B)
      series.push(
        { season:'2025-26', round:1, conference:conf, series_type:`playin_a_${c}`, seed_high:7, seed_low:8,  team_high:t7?.id, team_low:t8?.id,  games_needed:1, wins_high:0, wins_low:0, status:t7&&t8?'active':'scheduled' },
        { season:'2025-26', round:1, conference:conf, series_type:`playin_b_${c}`, seed_high:9, seed_low:10, team_high:t9?.id, team_low:t10?.id, games_needed:1, wins_high:0, wins_low:0, status:t9&&t10?'active':'scheduled' },
        { season:'2025-26', round:1, conference:conf, series_type:`playin_c_${c}`, seed_high:8, seed_low:9,  team_high:null,   team_low:null,    games_needed:1, wins_high:0, wins_low:0, status:'scheduled' }
      )

      // Round 1: 1v8, 2v7, 3v6, 4v5 (7 and 8 seeds TBD from play-in)
      series.push(
        { season:'2025-26', round:2, conference:conf, series_type:`r1_${c}_1v8`, seed_high:1, seed_low:8, team_high:t1?.id, team_low:null, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' },
        { season:'2025-26', round:2, conference:conf, series_type:`r1_${c}_2v7`, seed_high:2, seed_low:7, team_high:t2?.id, team_low:null, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' },
        { season:'2025-26', round:2, conference:conf, series_type:`r1_${c}_3v6`, seed_high:3, seed_low:6, team_high:t3?.id, team_low:t6?.id, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' },
        { season:'2025-26', round:2, conference:conf, series_type:`r1_${c}_4v5`, seed_high:4, seed_low:5, team_high:t4?.id, team_low:t5?.id, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' }
      )

      // Conference Semis, Finals
      series.push(
        { season:'2025-26', round:3, conference:conf, series_type:`r2_${c}_a`, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' },
        { season:'2025-26', round:3, conference:conf, series_type:`r2_${c}_b`, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' },
        { season:'2025-26', round:4, conference:conf, series_type:`conf_final_${c}`, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' }
      )
    }

    // NBA Finals
    series.push({ season:'2025-26', round:5, series_type:'nba_finals', games_needed:7, wins_high:0, wins_low:0, status:'scheduled' })

    await supabaseAdmin.from('playoff_series').delete().eq('season','2025-26')
    const { error } = await supabaseAdmin.from('playoff_series').insert(series)
    if (error) return NextResponse.json({ error: error.message }, { status:500 })
    return NextResponse.json({ success:true, created:series.length })
  } catch(e:any) {
    return NextResponse.json({ error: e.message }, { status:500 })
  }
}
