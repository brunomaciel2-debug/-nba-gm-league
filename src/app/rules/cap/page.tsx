export default function CapRulesPage() {
  const rules = [
    { icon: '💰', title: 'Salary Cap — $180M', desc: 'Every team has a hard salary cap of $180M. No trade, free agent signing, or contract extension can push a team\'s total salary above this limit — there are no exceptions.' },
    { icon: '🔻', title: 'Minimum Salary — $1M', desc: 'No player can earn less than $1M per year, regardless of overall rating. This is the league-wide salary floor for any contract.' },
    { icon: '🔺', title: 'Maximum Salary — $50M', desc: 'No player can earn more than $50M per year. This is the league-wide ceiling, whether through free agency, trade, or contract extension.' },
    { icon: '👥', title: 'Roster Size — 12 to 15', desc: 'Teams must carry between 12 and 15 active players. The 12-player minimum is not enforced during the free agency window, since teams may temporarily dip below it while managing expiring contracts — but it must be resolved before the season locks the roster.' },
    { icon: '✂️', title: 'Cut Players & Dead Cap', desc: 'Releasing a player does not free up cap space immediately. Their salary remains on your cap as "dead money" until another team signs them as a free agent — at which point the charge moves to the new team and your cap space is restored.' },
    { icon: '🤝', title: 'Free Agency Signings', desc: 'Offers to free agents are validated against your available cap space and roster size before being submitted. If accepting an offer would push you over the cap or roster limit, the system blocks it automatically.' },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1a1512', margin: 0 }}>💰 Salary Cap Rules</h1>
        <p style={{ fontSize: 13, color: '#8a8279', marginTop: 6 }}>
          How the salary cap works across trades, free agency, and contract management.
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
        background: '#dbeafe', border: '1px solid #93c5fd',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>💡 Quick Summary</div>
        <div style={{ fontSize: 12, color: '#1d4ed8', lineHeight: 1.7 }}>
          Cap: $180M · Min salary: $1M · Max salary: $50M · Roster: 12–15 players · Cut players stay on your cap until signed elsewhere.
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <a href="/cap-space" style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', textDecoration: 'none' }}>
          View all teams' cap space →
        </a>
      </div>
    </div>
  )
}
