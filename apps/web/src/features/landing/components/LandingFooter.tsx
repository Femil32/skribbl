const ink = '#1a1714';

const COLS: [string, string[]][] = [
  ['play',   ['Create room','Join with code','Modes','Word packs']],
  ['learn',  ['How it plays','Tips & tricks','Streamer kit','Changelog']],
  ['about',  ['Team','Privacy','Terms','Contact']],
  ['follow', ['Twitter','Discord','TikTok','RSS']],
];

export default function LandingFooter() {
  return (
    <footer style={{ background: ink, color: '#fffdf6', padding: '64px 36px 30px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4,1fr)', gap: 36 }}>
        {/* Brand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: '#ff5a3c', border: '2.5px solid #fffdf6', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: ink, transform: 'rotate(-6deg)' }}>s</div>
            <span style={{ fontWeight: 900, fontSize: 28, letterSpacing: '-.02em' }}>skribbl</span>
          </div>
          <p style={{ marginTop: 14, maxWidth: 280, fontSize: 14, lineHeight: 1.5, color: 'rgba(245,239,230,.7)' }}>
            A multiplayer draw-and-guess game built for the kind of group chat that survives mortgages and weddings.
          </p>
        </div>

        {/* Link columns */}
        {COLS.map(([title, items]) => (
          <div key={title}>
            <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase' as const, color: 'rgba(245,239,230,.5)', marginBottom: 14 }}>{title}</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' as const, gap: 9 }}>
              {items.map(it => (
                <li key={it}><a href="#" style={{ color: '#fffdf6', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>{it}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 56, paddingTop: 22, borderTop: '1px dashed rgba(245,239,230,.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'rgba(245,239,230,.6)' }}>
        <div>© 2026 skribbl labs · drawn with too much love</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#3ddc97' }}/>
          all systems doodling
        </div>
      </div>
    </footer>
  );
}
