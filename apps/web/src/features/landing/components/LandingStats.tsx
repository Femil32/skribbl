const STATS = [
  { v:'2.4M+', l:'players ever'  },
  { v:'1.2M',  l:'rounds today'  },
  { v:'8,431', l:'curated words' },
  { v:'87ms',  l:'median ping'   },
];

export default function LandingStats() {
  return (
    <section id="stats" style={{ padding: '72px 36px', background: '#1a1714', color: '#fffdf6' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}>
        {STATS.map(s => (
          <div key={s.l} style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, paddingRight: 18, borderRight: '2px dashed rgba(245,239,230,.25)' }}>
            <div style={{ fontWeight: 900, fontSize: 72, lineHeight: .9, letterSpacing: '-.03em' }}>{s.v}</div>
            <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase' as const, color: 'rgba(245,239,230,.6)' }}>{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
