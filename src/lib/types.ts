export interface Team {
  id: string; name: string; conference: string; division: string
  color: string; arena: string; city: string
  wins: number; losses: number; pts_for: number; pts_against: number
  salary_cap: number; cap_used: number
}
export interface Player {
  id: string; name: string; pos: string; nationality?: string; age?: number
  team_id: string; salary: number; contract_years: number
  status: string; injury_type?: string; games_missed: number
  usage: number; three: number; layup: number; dunk: number; mid: number
  ft: number; siq: number; draw_foul: number; blk: number; stl: number
  idef: number; pdef: number; def_reb: number; off_reb: number
  stamina: number; durability: number; ball_hdl: number
  pass_vis: number; pass_iq: number; pressure: number; consistency: number
  crowd_effect: number; streaky: number; trash_talk: number; assist_role: number
  mins: number
}
export interface PlayerStats {
  id: string; player_id: string; season: string
  games: number; pts: number; reb: number; ast: number; stl: number; blk: number
  fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number
  turnovers: number
}
export interface Game {
  id: string; week_number: number; game_number: number
  home_team: string; away_team: string
  home_score?: number; away_score?: number; status: string; played_at?: string
}
export interface Article {
  id: string; title: string; slug: string; content: string
  excerpt?: string; cover_image?: string; tags?: string[]
  published: boolean; created_at: string; updated_at: string
}
export interface Transaction {
  id: string; type: string; description: string
  teams?: string[]; players?: string[]
  details?: Record<string, unknown>; status: string; created_at: string
}
export interface GmOrders {
  team_id: string; week_number: number
  priority_1?: string; priority_2?: string; priority_3?: string
  clutch_player?: string; pace: number; three_rate: number
  atk_style: string; def_style: string
  depth_chart?: Record<string, unknown>; locked: boolean
}
