export default function OrdersRulesPage() {
  const sections = [
    {
      title: 'Depth Chart',
      color: '#1d4ed8',
      icon: '📋',
      rules: [
        'Each of the 5 positions (PG, SG, SF, PF, C) has 3 slots: Starter, 1st Sub and 2nd Sub.',
        'Assign a player and minutes to each slot. The total minutes for a position must add up to exactly 48 to be valid — the progress bar turns green only at 48/48.',
        'A player can only be assigned to positions that make sense for their role, and minutes outside the 0–48 range are not allowed.',
      ],
    },
    {
      title: 'Ball Role per Player',
      color: '#c2410c',
      icon: '🏀',
      rules: [
        'Independent from minutes — this defines how each player uses the ball when they have it: Ball Dominant, Balanced, or Off-Ball.',
        'Ball Dominant players control most possessions and make the primary decisions. Off-Ball players move without the ball and finish plays created by others.',
        'This setting is about playstyle, not who finishes scoring plays — that\'s controlled separately by Offensive Priorities.',
      ],
    },
    {
      title: 'Offensive Priorities',
      color: '#b45309',
      icon: '🎯',
      rules: [
        'Set your 1st, 2nd and 3rd scoring options — the players who receive the ball most often in half-court scoring situations.',
        'This is about who finishes plays, not who controls the ball. A point guard can be Ball Dominant but not be the 1st scoring option.',
      ],
    },
    {
      title: 'Tactics',
      color: '#15803d',
      icon: '🧠',
      rules: [
        'Clutch Player: gets the ball in the final 2 minutes of a game decided by 5 points or fewer.',
        'Pace (50–100): controls how fast your team plays. High pace means more possessions per game and faster transitions; low pace means a slower, more controlled half-court game.',
        'Three-Point Rate (0–80%): the percentage of possessions ending in a 3-point attempt. NBA average is around 38% — higher values favour spacing and variance, lower values favour post play and mid-range.',
        'Attack Style: Motion, Pick & Roll, Fast Break, Isolation, or Post-Up — defines how your team generates offense in the half-court.',
        'Defense Style: Man-to-Man, Zone 2-3, Full-Court Press, or Pack the Paint — defines your team\'s defensive scheme.',
      ],
    },
    {
      title: 'Training Intensity',
      color: '#6d28d9',
      icon: '🏋️',
      rules: [
        'Five levels: Rest (+150% health regen), Light (+25%), Normal (full regen), Intense (−50% regen), and Max Load (−75% regen, injury risk).',
        'Higher intensity sharpens performance readiness but reduces recovery between games — balance this against your schedule and any banged-up players.',
      ],
    },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1a1512', margin: 0 }}>📋 Weekly Orders Guide</h1>
        <p style={{ fontSize: 13, color: '#8a8279', marginTop: 6 }}>
          How to configure your team's depth chart, tactics and training before each simulation.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sections.map(section => (
          <div key={section.title} style={{
            background: '#faf8f5', border: '1px solid #d4cdc5', borderTop: `3px solid ${section.color}`,
            borderRadius: 12, padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>{section.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: section.color }}>{section.title}</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {section.rules.map((r, i) => (
                <li key={i} style={{ fontSize: 13, color: '#5c554e', lineHeight: 1.6 }}>{r}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 20, padding: '16px 18px', borderRadius: 12,
        background: '#dbeafe', border: '1px solid #93c5fd',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>💡 Quick Summary</div>
        <div style={{ fontSize: 12, color: '#1d4ed8', lineHeight: 1.7 }}>
          Each position needs exactly 48 minutes across 3 slots · Ball Role ≠ Offensive Priority · Pace, 3PT Rate, Attack & Defense Style shape your team's game plan · Training Intensity trades recovery for readiness · Deadline: Sunday 23:59 Lisbon time.
        </div>
      </div>
    </div>
  )
}
