export default function ScoutingRulesPage() {
  const rules = [
    { icon: '🙈', title: 'Hidden Attributes', desc: 'Every prospect in the draft class has all 30 attributes hidden by default, shown as "???". You must scout a player to reveal their real, accurate attribute values — there is no guesswork or projection involved, what you reveal is the truth.' },
    { icon: '🔒', title: 'Overall Rating Stays Hidden', desc: 'The OVR (overall rating) of a prospect is never revealed to GMs, no matter how many attributes you scout. Only the commissioner can see it. You must judge prospects by their individual attributes.' },
    { icon: '👤', title: 'Private to Your Team', desc: 'Attributes you reveal are visible only to your own franchise. Other GMs do not see what you\'ve scouted, and you don\'t see what they have. Your scouting work is a competitive advantage.' },
    { icon: '📈', title: 'Weekly Scouting Points', desc: 'Your Scout generates points every week based on their Evaluation, Network, and Experience attributes. These points accumulate over the season and determine which scouting tier you\'ve unlocked.' },
    { icon: '🥉', title: 'Tier 1 — 100 points', desc: 'Unlocks sessions that reveal up to 6 attributes per session, costing 10 credits (about 1.7 credits per attribute). No weekly maintenance cost — this represents your scout\'s local network and standard college film study.' },
    { icon: '🥈', title: 'Tier 2 — 250 points', desc: 'Unlocks sessions that reveal up to 14 attributes per session, costing 15 credits (about 1.1 credits per attribute — a better ratio than Tier 1). Holding this tier costs $15K/week in maintenance, billed automatically from your balance regardless of whether you use a session that week.' },
    { icon: '🥇', title: 'Tier 3 — 400 points', desc: 'Unlocks sessions that reveal up to 24 attributes per session, costing 20 credits (about 0.8 credits per attribute — the best ratio in the game). Holding this tier costs $40K/week in maintenance, representing a full international scouting operation.' },
    { icon: '💡', title: 'The Patience Trade-off', desc: 'Because higher tiers reveal more attributes per credit spent, it\'s often smarter to let credits accumulate and wait for Tier 2 or 3 rather than spending everything at Tier 1. The cost of that patience is the recurring weekly maintenance bill once you reach a higher tier — a real financial trade-off between scouting depth and your team\'s cash flow.' },
    { icon: '🛒', title: 'How to Spend a Session', desc: 'Once a tier is unlocked, select it in the Scouting tab, then choose which attributes to reveal — freely distributed across any prospects you choose. You can reveal many attributes on one player, or spread them across several. Confirm to spend the session\'s credit cost (and money cost on Tier 2/3).' },
    { icon: '🔁', title: 'Credits Replenish Weekly', desc: 'Your spendable credits increase every week alongside your lifetime points. Tier unlocks are permanent once reached — they never downgrade, even as you spend credits on sessions.' },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1a1512', margin: 0 }}>🔍 Scouting Guide</h1>
        <p style={{ fontSize: 13, color: '#8a8279', marginTop: 6 }}>
          How to evaluate the draft class and unlock deeper scouting capability over the season.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rules.map((rule, idx) => (
          <div key={idx} style={{
            display: 'flex', gap: 14, padding: '16px 18px',
            background: '#faf8f5', border: '1px solid #d4cdc5', borderRadius: 12,
          }}>
            <div style={{ fontSize: 24, flexShrink: 0 }}>{rule.icon}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1512', marginBottom: 4 }}>{rule.title}</div>
              <div style={{ fontSize: 13, color: '#5c554e', lineHeight: 1.6 }}>{rule.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 20, padding: '16px 18px', borderRadius: 12,
        background: '#ede9fe', border: '1px solid #c4b5fd',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#6d28d9', marginBottom: 6 }}>💡 Quick Summary</div>
        <div style={{ fontSize: 12, color: '#6d28d9', lineHeight: 1.7 }}>
          Tier 1: 100pts → 6 reveals / 10 credits, no upkeep · Tier 2: 250pts → 14 reveals / 15 credits + $15K/week · Tier 3: 400pts → 24 reveals / 20 credits + $40K/week. Credit ratio improves at higher tiers — patience pays off. OVR always hidden. Reveals are private to your team.
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <a href="/draft" style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', textDecoration: 'none' }}>
          View Draft Class →
        </a>
      </div>
    </div>
  )
}
