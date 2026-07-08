import { supabaseAdmin } from '@/lib/supabase'
import { notify } from '@/lib/notifications'
import { getTeamLang, notifFanInteractionEvent, notifSocialResponsibilityEvent } from '@/lib/notifications-helpers'

const SEASON = '2025-26'

// ── PURE FORMULAS ─────────────────────────────────────────────────

// Baseline follower drift — purely a function of the manager's own quality,
// every week, no dice roll. A 50-rated manager holds steady; 80 grows the
// base ~0.6%/week; 20 shrinks it (an inactive/bad social presence loses
// relevance over time, same real-world dynamic as a dormant account).
export function baselineFollowerDrift(followers: number, smEngagement: number): number {
  return Math.round(followers * (smEngagement - 50) / 5000)
}

// Event probability this week, scaled by the manager's relevant attribute —
// a maxed-out (100) manager runs roughly one event every ~7 weeks; a weak
// (20) one runs one roughly every ~33 weeks.
export function eventProbability(attribute: number): number {
  return Math.max(0, attribute) / 100 * 0.15
}

export const LOYAL_FAN_MODIFIER_BUMP = 0.01   // real, small, permanent shift toward Loyal Fan share
export const MORALE_BUMP = 4                  // real players.moral bump (0-100 scale)
export const POPULARITY_BUMP = 1              // real teams.popularity bump (0-100 scale, capped)
export const FAME_BUMP = 3                    // real players.fame bump (0-100 scale, capped)
export const EVENT_FOLLOWER_BUMP_PCT = 0.015  // extra follower bump on top of baseline drift, per event

export type WeeklySocialMediaResult = {
  followerDelta: number
  fanInteractionFired: boolean
  socialResponsibilityFired: boolean
}

// Deterministic core (given already-rolled dice) — kept separate from the
// random rolls themselves so this can be unit-tested without mocking Math.random.
export function computeWeeklySocialMedia(
  followers: number, smEngagement: number, fanInteractionRoll: number, socialResponsibilityRoll: number,
  fanInteractionAttr: number, socialResponsibilityAttr: number,
): WeeklySocialMediaResult {
  const fanInteractionFired = fanInteractionRoll < eventProbability(fanInteractionAttr)
  const socialResponsibilityFired = socialResponsibilityRoll < eventProbability(socialResponsibilityAttr)
  let followerDelta = baselineFollowerDrift(followers, smEngagement)
  if (fanInteractionFired) followerDelta += Math.round(followers * EVENT_FOLLOWER_BUMP_PCT)
  if (socialResponsibilityFired) followerDelta += Math.round(followers * EVENT_FOLLOWER_BUMP_PCT)
  return { followerDelta, fanInteractionFired, socialResponsibilityFired }
}

// ── WEEKLY RESOLUTION ─────────────────────────────────────────────
// Real, no-op-safe (a team with no hired Social Media Manager simply gets no
// drift/events this week — followers stay exactly where they are, never a
// default/invented value).
export async function resolveWeeklySocialMedia(week: number): Promise<{ teamsProcessed: number, eventsResolved: number }> {
  const { data: managers } = await supabaseAdmin
    .from('coaches').select('team_id,sm_engagement,fan_interaction,social_responsibility')
    .eq('role', 'social_media_manager').eq('status', 'active').not('team_id', 'is', null)
  if (!managers?.length) return { teamsProcessed: 0, eventsResolved: 0 }

  const teamIds = managers.map((m: any) => m.team_id)
  const { data: teams } = await supabaseAdmin.from('teams').select('id,social_media_followers,popularity').in('id', teamIds)
  const teamById: Record<string, any> = {}
  ;(teams || []).forEach((t: any) => { teamById[t.id] = t })

  const { data: rosters } = await supabaseAdmin.from('players').select('id,name,team_id,moral,fame').eq('status', 'active').in('team_id', teamIds)
  const rosterByTeam: Record<string, any[]> = {}
  ;(rosters || []).forEach((p: any) => { (rosterByTeam[p.team_id] ||= []).push(p) })

  let eventsResolved = 0
  let teamsProcessed = 0
  for (const m of managers) {
    const team = teamById[m.team_id]
    if (!team) continue // free agents (no team_id) are fetched by the role filter above but never processed
    teamsProcessed++

    const result = computeWeeklySocialMedia(
      team.social_media_followers || 0, m.sm_engagement ?? 60,
      Math.random(), Math.random(),
      m.fan_interaction ?? 60, m.social_responsibility ?? 60,
    )

    const newFollowers = Math.max(0, (team.social_media_followers || 0) + result.followerDelta)
    await supabaseAdmin.from('teams').update({ social_media_followers: newFollowers }).eq('id', m.team_id)

    const roster = rosterByTeam[m.team_id] || []

    if (result.fanInteractionFired) {
      eventsResolved++
      // Meet & greet / autograph session — builds real, lasting fan
      // attachment (the arena_audience_modifiers extension point built for
      // exactly this), plus a morale lift for one real player involved.
      const { data: mod } = await supabaseAdmin.from('arena_audience_modifiers').select('loyal_fan_modifier').eq('team_id', m.team_id).single()
      const currentModifier = mod?.loyal_fan_modifier || 0
      await supabaseAdmin.from('arena_audience_modifiers').update({ loyal_fan_modifier: currentModifier + LOYAL_FAN_MODIFIER_BUMP, updated_at: new Date().toISOString() }).eq('team_id', m.team_id)
      if (roster.length) {
        const p = roster[Math.floor(Math.random() * roster.length)]
        await supabaseAdmin.from('players').update({ moral: Math.min(100, (p.moral ?? 80) + MORALE_BUMP) }).eq('id', p.id)
        const lang = await getTeamLang(m.team_id)
        const notif = notifFanInteractionEvent(lang, p.name)
        await notify(m.team_id, 'social_media', notif.subject, notif.body, { eventType: 'fan_interaction', playerId: p.id, playerName: p.name })
      }
    }

    if (result.socialResponsibilityFired) {
      eventsResolved++
      // Charity event — real franchise popularity bump (cascades into
      // segment mix, fame growth, and FA attractiveness — all three already
      // read teams.popularity) plus a "good character" fame bump for one
      // real player involved.
      await supabaseAdmin.from('teams').update({ popularity: Math.min(100, (team.popularity || 50) + POPULARITY_BUMP) }).eq('id', m.team_id)
      if (roster.length) {
        const p = roster[Math.floor(Math.random() * roster.length)]
        await supabaseAdmin.from('players').update({ fame: Math.min(100, (p.fame ?? 50) + FAME_BUMP) }).eq('id', p.id)
        const lang = await getTeamLang(m.team_id)
        const notif = notifSocialResponsibilityEvent(lang, p.name)
        await notify(m.team_id, 'social_media', notif.subject, notif.body, { eventType: 'social_responsibility', playerId: p.id, playerName: p.name })
      }
    }
  }

  return { teamsProcessed, eventsResolved }
}
