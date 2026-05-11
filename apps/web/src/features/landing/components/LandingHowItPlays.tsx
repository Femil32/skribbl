const ink = '#1a1714';
const ck = (x: number, y: number) => `${x}px ${y}px 0 0 ${ink}`;

const STEPS = [
  {
    num: '01', title: 'Spin up a room', bg: '#ffd23f',
    body: 'Pick rounds, draw time, and a word pack. Share the code or link with your friends. No signup, no app.',
    visual: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['6 rounds','80s','cryptids'].map(t => (
            <span key={t} style={{ padding: '6px 10px', background: '#fffdf6', border: `2px solid ${ink}`, borderRadius: 10, fontFamily: '"DM Mono",monospace', fontSize: 12, fontWeight: 700 }}>{t}</span>
          ))}
        </div>
        <div style={{ padding: '10px 14px', border: `2.5px solid ${ink}`, borderRadius: 12, background: '#fffdf6', fontFamily: '"DM Mono",monospace', fontSize: 16, fontWeight: 800, boxShadow: ck(2,3), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'rgba(26,23,20,.55)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase' as const }}>code</span>
          DOOD-9F2K
          <span style={{ fontSize: 12, color: 'rgba(26,23,20,.55)' }}>⧉</span>
        </div>
      </div>
    ),
  },
  {
    num: '02', title: 'Draw your word', bg: '#3ddc97',
    body: "When it's your turn, you get 3 word options. Pick one, then translate it into wonky lines while everyone watches in real time.",
    visual: (
      <div style={{ display: 'flex', gap: 8 }}>
        {['kraken','waffle','femur'].map((w, i) => (
          <div key={w} style={{
            flex: 1, padding: '12px 8px', textAlign: 'center' as const,
            background: '#fffdf6', border: `2.5px solid ${ink}`, borderRadius: 12,
            fontWeight: 800, fontSize: 15, boxShadow: ck(2,3), transform: `rotate(${(i-1)*1.2}deg)`,
          }}>{w}</div>
        ))}
      </div>
    ),
  },
  {
    num: '03', title: 'Guess fast, score big', bg: '#5b8def',
    body: 'Everyone else types guesses. First in scores the most, drawer earns points for every correct guess. Best of the round wins.',
    visual: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
        {[
          ['glitchwolf','carrot?',false,''],
          ['kitkatdraws','octopus',false,''],
          ['doodlebob','KRAKEN',true,'+140'],
          ['pixelpaws','kraken',true,'+90'],
        ].map(([who,msg,ok,pts],i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 8, fontSize: 13, background: ok ? 'rgba(61,220,151,.28)' : '#fffdf6', border: `1.5px solid ${ink}` }}>
            <strong>{who as string}</strong>
            <span style={{ fontWeight: ok ? 800 : 500 }}>{msg as string}</span>
            {ok && <span style={{ marginLeft: 'auto', fontFamily: '"DM Mono",monospace', fontSize: 11, fontWeight: 800 }}>{pts as string}</span>}
          </div>
        ))}
      </div>
    ),
  },
];

export default function LandingHowItPlays() {
  return (
    <section id="how" style={{ padding: '88px 36px', background: '#fff7e8', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40, gap: 24, flexWrap: 'wrap' as const }}>
        <div>
          <span style={{ display: 'inline-flex', padding: '4px 10px', border: `2px solid ${ink}`, borderRadius: 99, background: '#fffdf6', fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' as const }}>how it plays</span>
          <h2 style={{ margin: '14px 0 0', fontWeight: 900, fontSize: 64, lineHeight: .95, letterSpacing: '-.03em', maxWidth: 720 }}>
            Three buttons,<br/>infinite chaos.
          </h2>
        </div>
        <div style={{ fontSize: 16, color: 'rgba(26,23,20,.55)', maxWidth: 360, lineHeight: 1.5 }}>
          The whole game fits on one screen. The whole rulebook fits in three steps.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
        {STEPS.map((s, i) => (
          <div key={s.num} style={{
            background: '#fffdf6', border: `3px solid ${ink}`, borderRadius: 22,
            boxShadow: ck(6,8), padding: 24,
            display: 'flex', flexDirection: 'column' as const, gap: 18,
            transform: `rotate(${(i-1)*0.4}deg)`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 38, lineHeight: 1, padding: '4px 14px', background: s.bg, border: `2.5px solid ${ink}`, borderRadius: 14, boxShadow: ck(2,3) }}>{s.num}</div>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 24, letterSpacing: '-.01em' }}>{s.title}</h3>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{s.body}</p>
            <div style={{ marginTop: 'auto', padding: 14, background: '#fdf3d8', border: `2.5px dashed ${ink}`, borderRadius: 14 }}>{s.visual}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
