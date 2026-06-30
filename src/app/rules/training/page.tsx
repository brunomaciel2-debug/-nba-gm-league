export default function TrainingRulesPage() {
  const rules = [
    { icon: '🏋️', title: 'Training Slots', desc: 'Each player development category — Offense, Defense, Physical, Playmaking, Mental, Recovery, Shooting Lab, and Analytics — has its own training slot that fills up over time and can be spent to develop your roster.' },
    { icon: '🔋', title: 'Credits Fill Over Time', desc: 'Slots accumulate credits passively each week. A slot is considered "full" at 10 credits — once full, it stops accumulating further until you spend the credits, so unused capacity is wasted if left untouched.' },
    { icon: '💪', title: 'Spending Credits', desc: 'In the Training tab, allocate available credits to specific players to boost their development in that category\'s related attributes. The more credits invested in a player, the faster they grow toward their potential.' },
    { icon: '📈', title: 'Potential Caps', desc: 'Every player has a hidden potential ceiling for each attribute. Training accelerates progress toward that ceiling but cannot push an attribute beyond it — scouting and player cards show potential grades (A–F) as a guide to how much room a player has to grow.' },
    { icon: '🎓', title: 'Coaching Staff Impact', desc: 'Your Head Coach and Assistant Coach\'s development ratings (Off. Development, Def. Development, Tactical, Physical, Mental) directly influence how effective your training sessions are. Better coaches accelerate the same credit spend further.' },
    { icon: '⏰', title: 'Don\'t Let Slots Cap Out', desc: 'Since slots stop filling once full, the inbox will notify you when credits are ready and waiting. Check the Training tab regularly to avoid wasting development capacity, especially during busy stretches of the season.' },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1a1512', margin: 0 }}>🏋️ Training Rules</h1>
        <p style={{ fontSize: 13, color: '#8a8279', marginTop: 6 }}>
          How player development credits accumulate and how to spend them effectively.
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
        background: '#dcfce7', border: '1px solid #bbf7d0',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 6 }}>💡 Quick Summary</div>
        <div style={{ fontSize: 12, color: '#15803d', lineHeight: 1.7 }}>
          8 training categories · Slots fill to 10 credits max, then stop · Spend credits on players to push toward their potential cap · Coach quality amplifies every credit spent.
        </div>
      </div>
    </div>
  )
}
