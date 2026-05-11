const ink = '#1a1714';
const ck = (x: number, y: number) => `${x}px ${y}px 0 0 ${ink}`;

const ITEMS = [
  { title:'Real-time, zero lag',    body:'WebSocket strokes at 60fps. Your wobbly circles arrive instantly.',  accent:'#3ddc97' },
  { title:'Voice chat (optional)', body:'Hear the gasps. Mute the screams. Push-to-talk built in.',           accent:'#5b8def' },
  { title:'Spectator mode',        body:'Watch friends suffer without joining the carnage.',                  accent:'#ffd23f' },
  { title:'Save your masterpieces',body:'Every round auto-archives. Re-watch the disasters in slow motion.',  accent:'#ff5a3c' },
  { title:'Built for streaming',   body:'OBS overlay, vote-based word picks, viewer guesses.',                accent:'#c084fc' },
  { title:'No signup, no app',     body:'Drop into a room from a browser. Mobile works too if you must.',     accent:'#ff7ab6' },
];

export default function LandingFeatures() {
  return (
    <section style={{ padding: '88px 36px', background: '#fdf3d8', borderTop: `2px solid ${ink}`, borderBottom: `2px solid ${ink}` }}>
      <div style={{ marginBottom: 36 }}>
        <span style={{ display: 'inline-flex', padding: '4px 10px', border: `2px solid ${ink}`, borderRadius: 99, background: '#fffdf6', fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' as const }}>under the hood</span>
        <h2 style={{ margin: '14px 0 0', fontWeight: 900, fontSize: 56, lineHeight: .95, letterSpacing: '-.03em' }}>Bigger than it looks.</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        {ITEMS.map((it, i) => (
          <div key={it.title} style={{ background: '#fffdf6', border: `2.5px solid ${ink}`, borderRadius: 18, boxShadow: ck(4,5), padding: '22px 22px 24px', display: 'flex', flexDirection: 'column' as const, gap: 10, position: 'relative' as const, overflow: 'hidden' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: it.accent, border: `2px solid ${ink}`, boxShadow: ck(2,3), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, transform: 'rotate(-6deg)' }}>
              {String(i+1).padStart(2,'0')}
            </div>
            <h3 style={{ margin: '6px 0 0', fontWeight: 800, fontSize: 22, letterSpacing: '-.01em' }}>{it.title}</h3>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
