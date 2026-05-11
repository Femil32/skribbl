const WORDS = [
  '🌵 cactus','🥁 banjo','🌯 burrito','🦑 kraken','🛹 skateboard',
  '🦴 femur','🚀 spaceship','🧇 waffle','🐙 octopus','📎 paperclip',
  '🍳 omelette','🦖 t-rex','🪩 disco ball','🎺 trumpet','🧦 sock',
  '🍕 pizza','🦔 hedgehog','🛼 rollerskate','🍉 watermelon','🎯 dartboard',
];

export default function LandingTicker() {
  const row = [...WORDS, ...WORDS];
  return (
    <div style={{
      position: 'relative',
      borderTop: '3px solid #1a1714', borderBottom: '3px solid #1a1714',
      background: '#ff5a3c', overflow: 'hidden', padding: '14px 0',
    }}>
      <div style={{
        display: 'flex', gap: 36,
        animation: 'ticker 60s linear infinite',
        whiteSpace: 'nowrap' as const,
      }}>
        {row.map((w, i) => (
          <span key={i} style={{
            fontWeight: 900, fontSize: 22, letterSpacing: '-.01em',
            display: 'inline-flex', alignItems: 'center', gap: 10,
          }}>
            {w}
            <span style={{ width: 6, height: 6, background: '#1a1714', borderRadius: 99 }}/>
          </span>
        ))}
      </div>
    </div>
  );
}
