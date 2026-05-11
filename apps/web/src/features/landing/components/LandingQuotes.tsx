const ink = '#1a1714';
const ck = (x: number, y: number) => `${x}px ${y}px 0 0 ${ink}`;

function Face({ color, mood }: { color: string; mood: string }) {
  const eyes = mood === 'wink'
    ? <><circle cx="14" cy="18" r="2" fill={ink}/><path d="M22 18 l5 0" stroke={ink} strokeWidth="2.2" strokeLinecap="round"/></>
    : mood === 'sleepy'
    ? <path d="M12 18 l5 0 M22 18 l5 0" stroke={ink} strokeWidth="2.2" strokeLinecap="round"/>
    : <><circle cx="14" cy="18" r="2" fill={ink}/><circle cx="26" cy="18" r="2" fill={ink}/></>;
  const mouth = mood === 'sleepy'
    ? <path d="M14 28 q6 -2 12 0" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round"/>
    : <path d="M13 25 q7 7 14 0" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round"/>;
  return (
    <svg width={36} height={36} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill={color} stroke={ink} strokeWidth="2"/>
      {eyes}{mouth}
    </svg>
  );
}

const QUOTES = [
  { who:'pixelpaws',    mood:'wink',   color:'#fb923c', text:'i drew a "kraken" and three people guessed "spider hat". perfect game.' },
  { who:'sharpie.queen',mood:'smile',  color:'#34d399', text:'we lost an entire friendship over the cryptids pack. 10/10' },
  { who:'doodlebob',    mood:'sleepy', color:'#4d96ff', text:'every team meeting now ends with 20 minutes of skribbl. i am unstoppable.' },
];

export default function LandingQuotes() {
  return (
    <section style={{ padding: '88px 36px', background: '#fff7e8' }}>
      <span style={{ display: 'inline-flex', padding: '4px 10px', border: `2px solid ${ink}`, borderRadius: 99, background: '#fffdf6', fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' as const }}>field reports</span>
      <h2 style={{ margin: '14px 0 36px', fontWeight: 900, fontSize: 56, lineHeight: .95, letterSpacing: '-.03em' }}>Receipts.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
        {QUOTES.map((q, i) => (
          <div key={q.who} style={{
            background: '#fffdf6', border: `2.5px solid ${ink}`, borderRadius: 20,
            padding: 24, boxShadow: ck(5,6), display: 'flex', flexDirection: 'column' as const, gap: 14,
            transform: `rotate(${(i-1)*0.6}deg)`,
          }}>
            <div style={{ fontWeight: 900, fontSize: 32, lineHeight: 1, color: '#ff5a3c' }}>"</div>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.4, fontWeight: 500 }}>{q.text}</p>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Face color={q.color} mood={q.mood}/>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{q.who}</div>
                <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'rgba(26,23,20,.55)' }}>★★★★★ verified doodler</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
