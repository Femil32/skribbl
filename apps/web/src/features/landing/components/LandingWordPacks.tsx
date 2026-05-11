const ink = '#1a1714';
const ck = (x: number, y: number) => `${x}px ${y}px 0 0 ${ink}`;

const PACKS = [
  { id:'classic',  label:'Classic',      desc:'The OG. Animals, objects, foods.',       count:1247, bg:'#fdf3d8', emoji:'🎨', tag:'free',  dashed:false },
  { id:'cryptids', label:'Cryptids',     desc:'Mothman, jersey devil, skinwalkers.',    count: 312, bg:'#3ddc97', emoji:'👁️', tag:'new',   dashed:false },
  { id:'snack',    label:'Snack Bar',    desc:'Food court fever dreams.',                count: 408, bg:'#ffd23f', emoji:'🌭', tag:'free',  dashed:false },
  { id:'movies',   label:'Movie Night',  desc:'Title charades for nerds.',               count: 561, bg:'#5b8def', emoji:'🎬', tag:'free',  dashed:false },
  { id:'office',   label:'Office Life',  desc:'Spreadsheets, lanyards, regret.',         count: 280, bg:'#ff7ab6', emoji:'📎', tag:'pro',   dashed:false },
  { id:'sci',      label:'Lab Coat',     desc:'Chemistry, anatomy, calculus.',           count: 491, bg:'#c084fc', emoji:'🧬', tag:'pro',   dashed:false },
  { id:'sports',   label:'Locker Room',  desc:'Plays, gear, mascots, fouls.',            count: 376, bg:'#ff5a3c', emoji:'🏈', tag:'free',  dashed:false },
  { id:'custom',   label:'Build your own', desc:'Drop a CSV. We tokenize. You draw.',   count: null, bg:'#fffdf6', emoji:'＋', tag:'pro',   dashed:true  },
];

export default function LandingWordPacks() {
  return (
    <section id="packs" style={{ padding: '88px 36px', background: '#fdf3d8', borderTop: `2px solid ${ink}`, borderBottom: `2px solid ${ink}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36, gap: 24, flexWrap: 'wrap' as const }}>
        <div>
          <span style={{ display: 'inline-flex', padding: '4px 10px', border: `2px solid ${ink}`, borderRadius: 99, background: '#fffdf6', fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' as const }}>word packs</span>
          <h2 style={{ margin: '14px 0 0', fontWeight: 900, fontSize: 64, lineHeight: .95, letterSpacing: '-.03em' }}>
            Pick a brain to break.
          </h2>
        </div>
        <div style={{ fontSize: 16, color: 'rgba(26,23,20,.55)', maxWidth: 380, lineHeight: 1.5 }}>
          12 packs, 8,000+ words, hand-curated by humans who clearly have too much time.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
        {PACKS.map((p, i) => (
          <div key={p.id} style={{
            background: p.bg,
            border: `${p.dashed ? '2.5px dashed' : '2.5px solid'} ${ink}`,
            borderRadius: 18, boxShadow: p.dashed ? 'none' : ck(4,5),
            padding: 18, display: 'flex', flexDirection: 'column' as const, gap: 10,
            transform: `rotate(${(i%4-1.5)*0.4}deg)`, position: 'relative' as const, minHeight: 170,
          }}>
            <div style={{ position: 'absolute' as const, top: 12, right: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' as const, padding: '3px 7px', borderRadius: 6, background: '#fffdf6', border: `1.5px solid ${ink}` }}>{p.tag}</span>
            </div>
            <div style={{ fontSize: 36, lineHeight: 1 }}>{p.emoji}</div>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 22, letterSpacing: '-.01em' }}>{p.label}</h3>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{p.desc}</p>
            <div style={{ marginTop: 'auto', fontFamily: '"DM Mono",monospace', fontSize: 12, fontWeight: 700 }}>
              {p.count != null ? `${p.count.toLocaleString()} words` : 'unlimited'}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
