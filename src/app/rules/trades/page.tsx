export default function TradeRulesPage() {
  const rules = [
    { icon: '⚖️', title: 'Salary Matching — ±15% + $1M', desc: 'The total salary your team sends out must roughly match what you receive, within a tolerance of 15% of the larger side plus $1M. This prevents lopsided trades that dump huge contracts for nothing in return.' },
    { icon: '💰', title: 'Cap Compliance', desc: 'After the trade, neither team can exceed the $180M salary cap. The trade proposal screen shows your projected cap for both sides in real time, and blocks submission if either team would go over.' },
    { icon: '🔀', title: '3-Team Trades', desc: 'Trades can involve up to three teams simultaneously. Salary matching rules apply to the overall structure of the deal, not just pairwise between two sides.' },
    { icon: '🎓', title: 'Draft Picks', desc: 'Draft picks can be included in any trade. Protected picks carry their protection status with them — if a pick is top-5 protected, that protection transfers to the new owner.' },
    { icon: '📨', title: 'Proposal & Response', desc: 'Trades are sent as proposals to the other team\'s GM, who can accept, reject, or let it expire. There is no automatic acceptance — every trade requires explicit approval from the receiving GM.' },
    { icon: '👑', title: 'Commissioner Oversight', desc: 'The commissioner can propose trades on behalf of any team and has final authority to veto trades that appear collusive or violate league integrity, even if both GMs have agreed.' },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1a1512', margin: 0 }}>🔄 Trade Rules</h1>
        <p style={{ fontSize: 13, color: '#8a8279', marginTop: 6 }}>
          Everything you need to know before proposing or accepting a trade.
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
          Salary match: ±15% + $1M · Both teams must stay under the $180M cap · Up to 3 teams per trade · Draft pick protections carry over.
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <a href="/trade-center" style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', textDecoration: 'none' }}>
          Go to Trade Center →
        </a>
      </div>
    </div>
  )
}
