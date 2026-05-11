import Link from 'next/link';
const ink = '#1a1714';
const ck = (x: number, y: number) => `${x}px ${y}px 0 0 ${ink}`;

const MODES = [
  { title:'Classic',       sub:'Free-for-all',          desc:'One drawer at a time, everyone else guesses. The way grandma played.',      tag:'best for 4–8',  bg:'#ff5a3c', fg: ink     },
  { title:'Battle Royale', sub:'Last sketcher standing', desc:'Wrong guesses cost a life. Three lives, one champion, zero mercy.',          tag:'best for 6–12', bg: ink,      fg:'#fffdf6' },
  { title:'Teams',         sub:'2 vs 2 vs 2',            desc:'Only your team sees the word. Drawing telephone meets pictionary.',          tag:'best for 6+',   bg:'#5b8def', fg: ink     },
];

export default function LandingModes() {
  return (
    <section id="modes" style={{ padding: '88px 36px', background: '#fff7e8' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36, gap: 24, flexWrap: 'wrap' as const }}>
        <div>
          <span style={{ display: 'inline-flex', padding: '4px 10px', border: `2px solid ${ink}`, borderRadius: 99, background: '#fffdf6', fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' as const }}>game modes</span>
          <h2 style={{ margin: '14px 0 0', fontWeight: 900, fontSize: 64, lineHeight: .95, letterSpacing: '-.03em', maxWidth: 800 }}>
            Three ways to lose friends.
          </h2>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
        {MODES.map((m, i) => (
          <div key={m.title} style={{
            position: 'relative' as const, overflow: 'hidden',
            background: m.bg, color: m.fg,
            border: `3px solid ${ink}`, borderRadius: 22, boxShadow: ck(6,8),
            padding: '28px 24px', minHeight: 280, display: 'flex', flexDirection: 'column' as const,
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase' as const, opacity: .65 }}>{m.sub}</div>
            <h3 style={{ margin: '6px 0 14px', fontWeight: 900, fontSize: 40, letterSpacing: '-.02em', lineHeight: 1 }}>{m.title}</h3>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 280 }}>{m.desc}</p>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ padding: '6px 12px', borderRadius: 99, border: `2px solid ${m.fg}`, fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' as const }}>{m.tag}</span>
              <Link href="/lobby" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 900, fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>try it →</Link>
            </div>
            <div style={{ position: 'absolute' as const, top: -10, right: 12, fontWeight: 900, fontSize: 130, lineHeight: 1, opacity: .08, letterSpacing: '-.05em' }}>{`0${i+1}`}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
