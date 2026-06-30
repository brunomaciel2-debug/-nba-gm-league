export default function SponsorRulesPage() {
  const tiers = [
    { icon: '👕', title: 'Jersey Patch', color: '#1d4ed8', desc: 'The highest-value sponsor tier, placed on your team\'s jersey. Highest fixed payments and bonus potential, but also the highest-profile objectives tied to team success — wins, playoff runs, and individual stardom.' },
    { icon: '🏀', title: 'Court Logo', color: '#b45309', desc: 'Painted at center court with permanent camera focus during every broadcast. Mid-tier fixed payments with objectives focused on scoring, health, and postseason performance.' },
    { icon: '📺', title: 'Courtside Panels', color: '#15803d', desc: 'Rotating electronic panels around the court perimeter. Lower fixed payments but achievable objectives tied to home performance, streaks, and arena development.' },
  ]

  const rules = [
    { icon: '💵', title: 'Fixed Monthly Payment', desc: 'Every sponsor contract guarantees a fixed payment each month regardless of performance, automatically credited to your balance and logged in your Finances tab.' },
    { icon: '🎯', title: 'Bonus Objectives', desc: 'Each sponsor contract includes several bonus objectives — specific, measurable targets like win totals, playoff appearances, or attendance figures. Hitting an objective pays out its bonus amount on top of the fixed salary.' },
    { icon: '✅', title: 'Automatic Tracking', desc: 'Objectives are checked automatically after every simulation. You don\'t need to claim anything manually — the moment a target is hit, the bonus is credited and you receive an inbox notification.' },
    { icon: '📊', title: 'Goals Tab Tracking', desc: 'The Goals tab on your team page shows every active objective across all your sponsor contracts, with live progress bars and filters for pending versus achieved goals.' },
    { icon: '🔢', title: 'One Contract Per Tier', desc: 'A team can hold one active sponsor contract per tier (Jersey, Court, Panels) at a time — three sponsors total. Choose carefully, as contracts run for the full season.' },
    { icon: '🏷️', title: 'Company Information', desc: 'Each sponsor option shows the real company name and a brief description of who they are, visible via the info tooltip next to their name — helping you choose a sponsor that fits your franchise identity.' },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1a1512', margin: 0 }}>🎯 Sponsor Objectives</h1>
        <p style={{ fontSize: 13, color: '#8a8279', marginTop: 6 }}>
          How sponsor contracts, payments, and bonus objectives work.
        </p>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#8a8279', marginBottom: 10 }}>
        Sponsor Tiers
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
        {tiers.map(t => (
          <div key={t.title} style={{
            padding: 14, borderRadius: 12, background: '#faf8f5',
            border: '1px solid #d4cdc5', borderTop: `3px solid ${t.color}`,
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{t.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.color, marginBottom: 4 }}>{t.title}</div>
            <div style={{ fontSize: 11, color: '#5c554e', lineHeight: 1.5 }}>{t.desc}</div>
          </div>
        ))}
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
        background: '#dcfce7', border: '1px solid #bbf7d0',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 6 }}>💡 Quick Summary</div>
        <div style={{ fontSize: 12, color: '#15803d', lineHeight: 1.7 }}>
          3 tiers (Jersey, Court, Panels), one contract each · Fixed monthly pay + bonus objectives · Auto-tracked after every simulation · Progress visible in the Goals tab.
        </div>
      </div>
    </div>
  )
}
