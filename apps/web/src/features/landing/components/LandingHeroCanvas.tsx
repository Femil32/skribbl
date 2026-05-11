// apps/web/src/features/landing/components/LandingHeroCanvas.tsx

function Face({ color, size = 36, mood = 'smile' }: { color: string; size?: number; mood?: string }) {
  const ink = '#1a1714';
  const eyes = mood === 'wink'
    ? <><circle cx="14" cy="18" r="2" fill={ink}/><path d="M22 18 l5 0" stroke={ink} strokeWidth="2.2" strokeLinecap="round"/></>
    : mood === 'sleepy'
    ? <path d="M12 18 l5 0 M22 18 l5 0" stroke={ink} strokeWidth="2.2" strokeLinecap="round"/>
    : <><circle cx="14" cy="18" r="2" fill={ink}/><circle cx="26" cy="18" r="2" fill={ink}/></>;
  const mouth = mood === 'sleepy'
    ? <path d="M14 28 q6 -2 12 0" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round"/>
    : <path d="M13 25 q7 7 14 0" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round"/>;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill={color} stroke={ink} strokeWidth="2"/>
      {eyes}{mouth}
    </svg>
  );
}

export default function LandingHeroCanvas() {
  const ink = '#1a1714';
  return (
    <div style={{
      position: 'relative', background: '#fffdf6',
      border: `3px solid ${ink}`, borderRadius: 22,
      boxShadow: '8px 10px 0 0 #1a1714', padding: 14,
      transform: 'rotate(1.5deg)',
    }}>
      {/* Window chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ff5a3c','#ffd23f','#3ddc97'].map(c => (
            <span key={c} style={{ width: 11, height: 11, borderRadius: 99, background: c, border: `1.5px solid ${ink}` }}/>
          ))}
        </div>
        <div style={{ marginLeft: 8, fontFamily: '"DM Mono", monospace', fontSize: 11, color: 'rgba(26,23,20,.55)' }}>
          room <strong style={{ color: ink }}>dood-9f2k</strong> · round 3 of 6
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ border: `2px solid ${ink}`, borderRadius: 10, padding: '4px 10px', background: '#ffd23f', fontWeight: 900, fontSize: 16 }}>
            00:23
          </div>
        </div>
      </div>

      {/* Canvas area */}
      <div style={{ position: 'relative', aspectRatio: '4/3', background: '#fdf3d8', border: `2.5px solid ${ink}`, borderRadius: 14, overflow: 'hidden' }}>
        {/* dot grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(26,23,20,.08) 1px,transparent 1.4px)', backgroundSize: '18px 18px' }}/>

        {/* cactus SVG */}
        <svg viewBox="0 0 400 300" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <path d="M150 220 L250 220 L240 270 L160 270 Z" fill="#ff7ab6" stroke={ink} strokeWidth="3.5" strokeLinejoin="round"/>
          <line x1="148" y1="220" x2="252" y2="220" stroke={ink} strokeWidth="3.5"/>
          <path d="M156 220 q44 -10 88 0" fill="#7a3e15" stroke={ink} strokeWidth="3"/>
          <path d="M180 220 q-2 -60 0 -90 q2 -22 20 -22 q18 0 20 22 q2 30 0 90 Z" fill="#3ddc97" stroke={ink} strokeWidth="3.5" strokeLinejoin="round"/>
          <path d="M180 170 q-22 -2 -24 -22 q-2 -16 14 -16 q12 0 12 14" fill="#3ddc97" stroke={ink} strokeWidth="3.5" strokeLinejoin="round"/>
          <path d="M220 160 q22 -2 24 -22 q2 -16 -14 -16 q-12 0 -12 14" fill="#3ddc97" stroke={ink} strokeWidth="3.5" strokeLinejoin="round"/>
          {[140,170,200].map((y,i) => (
            <g key={i}>
              <path d={`M188 ${y} l-4 -3 M192 ${y+8} l-4 -3`} stroke={ink} strokeWidth="2" strokeLinecap="round"/>
              <path d={`M212 ${y} l4 -3 M208 ${y+8} l4 -3`} stroke={ink} strokeWidth="2" strokeLinecap="round"/>
            </g>
          ))}
          <circle cx="200" cy="100" r="9" fill="#ff5a3c" stroke={ink} strokeWidth="2.5"/>
          <circle cx="200" cy="100" r="3" fill="#ffd23f"/>
          <circle cx="345" cy="55" r="22" fill="#ffd23f" stroke={ink} strokeWidth="3"/>
          {[0,45,90,135,180,225,270,315].map(a => {
            const r=22, r2=33;
            const x1=345+Math.cos(a*Math.PI/180)*r, y1=55+Math.sin(a*Math.PI/180)*r;
            const x2=345+Math.cos(a*Math.PI/180)*r2, y2=55+Math.sin(a*Math.PI/180)*r2;
            return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ink} strokeWidth="3" strokeLinecap="round"/>;
          })}
          <path d="M30 275 q40 -8 80 0 t80 0 t80 0 t80 0" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round"/>
        </svg>

        {/* word blanks */}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, fontFamily: '"DM Mono", monospace' }}>
          {['c','_','c','t','_','s'].map((c,i) => (
            <span key={i} style={{
              width: 22, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${ink}`, borderRadius: 6,
              background: c === '_' ? 'rgba(255,255,255,.6)' : '#fffdf6',
              fontWeight: 800, fontSize: 14,
            }}>{c === '_' ? '' : c}</span>
          ))}
        </div>

        {/* drawer label */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#fffdf6', border: `2px solid ${ink}`, borderRadius: 99,
          padding: '4px 10px 4px 4px', boxShadow: '2px 3px 0 0 #1a1714',
          fontSize: 12, fontWeight: 800,
        }}>
          <Face color="#fb923c" size={22}/> pixelpaws
          <span style={{ color: 'rgba(26,23,20,.55)', fontWeight: 600 }}>· drawing</span>
        </div>

        {/* tool dock */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 6,
          padding: 4, background: '#fffdf6', border: `2px solid ${ink}`, borderRadius: 99,
          boxShadow: '2px 3px 0 0 #1a1714',
        }}>
          {['#1a1714','#ff5a3c','#ffd23f','#3ddc97','#5b8def','#c084fc'].map((c,i) => (
            <span key={c} style={{
              width: 18, height: 18, borderRadius: 99, background: c,
              border: `2px solid ${ink}`,
              outline: i === 2 ? `2px solid ${ink}` : 'none', outlineOffset: 2,
            }}/>
          ))}
        </div>

        {/* correct guess bubble */}
        <div style={{
          position: 'absolute', bottom: 18, right: 14,
          background: '#3ddc97', border: `2.5px solid ${ink}`, borderRadius: 14,
          padding: '6px 10px', fontSize: 12, fontWeight: 800,
          boxShadow: '2px 3px 0 0 #1a1714', transform: 'rotate(-2deg)',
        }}>✓ kitkatdraws guessed it!</div>
      </div>

      {/* chat preview */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          ['doodlebob','candle?', false],
          ['glitchwolf','carrot', false],
          ['kitkatdraws','CACTUS', true],
        ].map(([who, msg, ok], i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 8px', borderRadius: 8,
            background: ok ? 'rgba(61,220,151,.22)' : 'transparent', fontSize: 13,
          }}>
            <span style={{ fontWeight: 800, fontSize: 12 }}>{who as string}</span>
            <span style={{ fontWeight: ok ? 800 : 500 }}>{msg as string}</span>
            {ok && <span style={{ marginLeft: 'auto', fontFamily: '"DM Mono", monospace', fontSize: 11, fontWeight: 800, color: '#1a7a3a' }}>+120</span>}
          </div>
        ))}
      </div>

      {/* stickers */}
      <div style={{ position: 'absolute', top: -22, left: -22 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#5b8def', border: `2.5px solid ${ink}`, borderRadius: 14,
          padding: '8px 12px', boxShadow: '3px 4px 0 0 #1a1714',
          fontWeight: 800, fontSize: 13, transform: 'rotate(-10deg)',
        }}>🎉 1.2M rounds today</div>
      </div>
      <div style={{ position: 'absolute', bottom: -18, right: -16 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#ffd23f', border: `2.5px solid ${ink}`, borderRadius: 14,
          padding: '8px 12px', boxShadow: '3px 4px 0 0 #1a1714',
          fontWeight: 800, fontSize: 13, transform: 'rotate(6deg)',
        }}>no signup needed</div>
      </div>
    </div>
  );
}
