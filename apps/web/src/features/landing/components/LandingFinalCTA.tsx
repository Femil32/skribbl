import Link from 'next/link';
const ink = '#1a1714';
const ck = (x: number, y: number) => `${x}px ${y}px 0 0 ${ink}`;

export default function LandingFinalCTA() {
  return (
    <section style={{ padding: '64px 36px 100px', background: '#fff7e8' }}>
      <div style={{
        position: 'relative' as const, background: '#ff5a3c',
        border: `3px solid ${ink}`, borderRadius: 28, boxShadow: ck(10,12),
        padding: '64px 56px', overflow: 'hidden',
      }}>
        {/* decorative sun */}
        <svg style={{ position: 'absolute' as const, top: 20, right: 60, opacity: .9 }} width="90" height="90" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="22" fill="#ffd23f" stroke={ink} strokeWidth="3"/>
          {[0,45,90,135,180,225,270,315].map(a => {
            const r=22, r2=34;
            const x1=45+Math.cos(a*Math.PI/180)*r, y1=45+Math.sin(a*Math.PI/180)*r;
            const x2=45+Math.cos(a*Math.PI/180)*r2, y2=45+Math.sin(a*Math.PI/180)*r2;
            return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ink} strokeWidth="3" strokeLinecap="round"/>;
          })}
        </svg>
        {/* wave squiggle */}
        <svg style={{ position: 'absolute' as const, bottom: -10, left: 40, opacity: .85 }} width="120" height="70" viewBox="0 0 120 70">
          <path d="M5 50 q15 -30 30 0 t30 0 t30 0 t30 0" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round"/>
        </svg>

        <div style={{ position: 'relative' as const, maxWidth: 760 }}>
          <span style={{ display: 'inline-flex', padding: '4px 10px', border: `2px solid ${ink}`, borderRadius: 99, background: '#fffdf6', fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' as const, transform: 'rotate(-2deg)' }}>last call</span>
          <h2 style={{ margin: '16px 0 16px', fontWeight: 900, fontSize: 88, lineHeight: .9, letterSpacing: '-.035em' }}>Grab a marker.</h2>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 500, lineHeight: 1.5, maxWidth: 540 }}>
            Free, in your browser, in under ten seconds. Bring four friends or play with strangers — either way, someone is about to draw a horrible pelican.
          </p>
          <div style={{ marginTop: 32, display: 'flex', gap: 14, flexWrap: 'wrap' as const }}>
            <Link href="/lobby" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', background: ink, color: '#fffdf6', border: `3px solid ${ink}`, borderRadius: 16, padding: '18px 24px', boxShadow: ck(5,6), fontWeight: 900, fontSize: 22 }}>play free →</Link>
            <Link href="#how" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', background: '#fffdf6', color: ink, border: `3px solid ${ink}`, borderRadius: 16, padding: '18px 24px', boxShadow: ck(5,6), fontWeight: 900, fontSize: 18 }}>read the rules</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
