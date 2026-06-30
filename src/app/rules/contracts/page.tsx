export default function ContractRulesPage() {
  const rules = [
    {
      icon: '🔒',
      title: 'Eligibility Window',
      desc: 'A player becomes eligible for a contract extension only when they have 2 years or fewer remaining on their current deal. This prevents teams from locking up rosters years in advance and keeps negotiation timing strategic.',
    },
    {
      icon: '💰',
      title: 'Maximum Annual Salary — $50M',
      desc: 'No player in the league can earn more than $50M per year, regardless of overall rating. This is the hard salary ceiling for any individual contract, extension or free agency offer.',
    },
    {
      icon: '📈',
      title: '+40% Raise Cap',
      desc: 'An extension offer cannot exceed 40% above the player\'s current salary. This keeps raises realistic and prevents sudden, unrealistic jumps in a single negotiation.',
    },
    {
      icon: '🧮',
      title: 'Three Limits, Lowest Wins',
      desc: 'The maximum you can actually offer a player is the lowest of: the $50M league cap, the +40% raise limit, or your team\'s available cap space. The extension panel always shows you this number directly.',
    },
    {
      icon: '📅',
      title: 'Contract Length — 2 to 5 Years',
      desc: 'Extensions can run from 2 to 5 years. Longer deals offer the player more security but tie up your cap space for longer — choose based on your timeline.',
    },
    {
      icon: '🎯',
      title: 'Fair Value Reference',
      desc: 'Every player has an estimated fair value based on their overall rating. Offers significantly below this value are likely to be rejected — the panel shows you this benchmark before you offer.',
    },
    {
      icon: '🚫',
      title: 'Salary Cap Compliance',
      desc: 'No extension can push your team over the $180M salary cap. If you don\'t have the cap space, you\'ll need to create room — through trades, cuts, or letting other contracts expire — before extending.',
    },
    {
      icon: '✋',
      title: 'One Offer Per Season',
      desc: 'Each player can only receive one extension offer per season. If rejected, you cannot try again until next season — and you risk losing the player to free agency if their contract expires first.',
    },
    {
      icon: '🤔',
      title: 'What Influences a Player\'s Decision',
      desc: 'Players weigh several factors: how your offer compares to their fair value, their current morale, and their age. Veterans nearing the end of their careers value security and are easier to re-sign. Young breakout stars are more likely to test free agency even with a fair offer, since they want to see their full market value.',
    },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1a1512', margin: 0 }}>📜 Contract Extension Rules</h1>
        <p style={{ fontSize: 13, color: '#8a8279', marginTop: 6 }}>
          Everything you need to know before offering a contract extension to one of your players.
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
          League max: $50M/yr · Max raise: +40% · Contract length: 2–5 years · Eligible at ≤2 years remaining · One offer per player per season · Must stay under the $180M team salary cap.
        </div>
      </div>
    </div>
  )
}
