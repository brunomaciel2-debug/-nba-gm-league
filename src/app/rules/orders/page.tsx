export default function OrdersRulesPage() {
  const rules = [
    { icon: '📋', title: 'What Weekly Orders Cover', desc: 'Each cycle, GMs set instructions for how their team should play and prepare: rotation minutes, offensive and defensive style preferences, pace, and training intensity. These settings directly influence simulation outcomes.' },
    { icon: '⏰', title: 'Submission Deadline', desc: 'Orders must be submitted before each simulation cycle (Monday and Thursday). If no orders are submitted, the team uses its previous settings or sensible defaults set by the coaching staff.' },
    { icon: '🔔', title: 'Reminder Notifications', desc: 'The system sends an inbox reminder every other week prompting GMs to review and update their orders before the next deadline, so it\'s easy to stay on top of weekly preparation.' },
    { icon: '🎯', title: 'Style Match Bonus', desc: 'If your weekly tactical orders match your Head Coach or Assistant Coach\'s preferred style (e.g. Pick & Roll offense, Man-to-Man defense), your team receives a performance boost for that cycle.' },
    { icon: '🔄', title: 'Orders Persist Until Changed', desc: 'Once submitted, your orders remain active for every simulation until you update them again — there\'s no need to resubmit identical orders every week if your strategy hasn\'t changed.' },
    { icon: '⚖️', title: 'Balance Risk and Reward', desc: 'Aggressive settings (high pace, heavy minutes for stars) can boost output but increase fatigue and injury risk. Conservative settings protect player health at the cost of some performance ceiling.' },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1a1512', margin: 0 }}>📋 Weekly Orders Guide</h1>
        <p style={{ fontSize: 13, color: '#8a8279', marginTop: 6 }}>
          How to set your team's instructions before each simulation cycle.
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
          Submit before Monday/Thursday simulations · Orders persist until updated · Matching your coach's style gives a performance bonus · Aggressive settings trade injury risk for output.
        </div>
      </div>
    </div>
  )
}
