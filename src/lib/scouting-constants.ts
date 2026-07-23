// Split out of scouting.ts on purpose — that file creates a Supabase
// client with the server-only SUPABASE_SERVICE_ROLE_KEY at module scope,
// which crashes instantly if bundled into client code (the key is
// undefined in the browser, and createClient throws on an empty key).
// ScoutingTab.tsx and ProspectPageClient.tsx are 'use client' components
// that only need these two constants, not the server-side scouting logic,
// so they import from here instead.
export const TOTAL_ATTRIBUTES = 29

export const SCOUTABLE_ATTRIBUTES = [
  'three','layup','dunk','mid','ft','siq','draw_foul',
  'blk','stl','idef','pdef',
  'def_reb','off_reb',
  'stamina','durability','speed','agility','strength',
  'ball_hdl','pass_vis','pass_iq','assist_role',
  'pressure','consistency','crowd_effect','streaky','trash_talk',
  'close_shot','standing_dunk',
]
