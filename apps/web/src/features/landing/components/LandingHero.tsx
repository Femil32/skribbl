'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LandingHeroCanvas from './LandingHeroCanvas';

const FACES = [
  { color: '#ff6b6b', mood: 'smile' },
  { color: '#ffd93d', mood: 'wink' },
  { color: '#6bcb77', mood: 'smile' },
  { color: '#4d96ff', mood: 'sleepy' },
  { color: '#c084fc', mood: 'smile' },
] as const;

function Face({ color, mood }: { color: string; mood: string }) {
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
    <svg width={28} height={28} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill={color} stroke={ink} strokeWidth="2"/>
      {eyes}{mouth}
    </svg>
  );
}

export default function LandingHero() {
  const [code, setCode] = useState('');
  const router = useRouter();

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim()) router.push(`/join?code=${encodeURIComponent(code.trim())}`);
  }

  return (
    <section style={{
      position: 'relative', padding: '64px 36px 80px',
      display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 56, alignItems: 'center',
    }}>
      {/* dot grid bg */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(26,23,20,.07) 1.2px,transparent 1.5px)',
        backgroundSize: '24px 24px',
      }}/>

      {/* Left: copy + CTAs */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* tags */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', border: '2px solid #1a1714', borderRadius: 99,
            background: '#ffd23f', fontSize: 11, fontWeight: 800,
            letterSpacing: '.14em', textTransform: 'uppercase' as const,
          }}>v3.0 · word packs are here</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', border: '2px solid #1a1714', borderRadius: 99,
            background: '#fffdf6', fontSize: 11, fontWeight: 800,
            letterSpacing: '.14em', textTransform: 'uppercase' as const,
            transform: 'rotate(2deg)',
          }}>★ 4.8 · 38k ratings</span>
        </div>

        {/* headline */}
        <h1 style={{
          margin: 0, fontWeight: 900,
          fontSize: 'clamp(64px, 7.5vw, 104px)', lineHeight: .9, letterSpacing: '-.035em',
        }}>
          Draw it.<br/>Guess it.<br/>
          <span style={{
            display: 'inline-block', background: '#ff5a3c',
            padding: '0 12px 2px', border: '3px solid #1a1714', borderRadius: 18,
            transform: 'rotate(-2deg)', boxShadow: '6px 7px 0 0 #1a1714', marginTop: 6,
          }}>Roast it.</span>
        </h1>

        <p style={{ marginTop: 26, maxWidth: 480, fontSize: 18, lineHeight: 1.45, fontWeight: 500 }}>
          A multiplayer doodle-and-guess party with friends, strangers, or your worst coworkers.
          Pick a word pack, grab a marker, and watch chaos unfold in 80 seconds or less.
        </p>

        {/* CTAs */}
        <div style={{ marginTop: 30, display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' as const }}>
          <Link href="/lobby" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none',
            background: '#1a1714', color: '#fffdf6',
            border: '3px solid #1a1714', borderRadius: 16, padding: '16px 22px',
            boxShadow: '5px 6px 0 0 #1a1714', fontWeight: 900, fontSize: 20,
          }}>
            <span style={{
              width: 26, height: 26, borderRadius: 99, background: '#ff5a3c',
              border: '2px solid #fffdf6', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>+</span>
            create a room
          </Link>

          <form onSubmit={handleJoin} style={{
            display: 'flex', alignItems: 'stretch',
            border: '3px solid #1a1714', borderRadius: 16, overflow: 'hidden',
            background: '#fffdf6', boxShadow: '5px 6px 0 0 #1a1714',
          }}>
            <span style={{
              padding: '0 10px', display: 'flex', alignItems: 'center',
              fontFamily: '"DM Mono", monospace', fontSize: 11, color: 'rgba(26,23,20,.55)',
              borderRight: '2px solid #1a1714', fontWeight: 800, letterSpacing: '.14em',
              textTransform: 'uppercase' as const,
            }}>code</span>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="DOOD-····"
              aria-label="Room code"
              style={{
                border: 'none', outline: 'none', padding: '14px 16px',
                fontFamily: '"DM Mono", monospace', fontSize: 17, fontWeight: 700,
                background: 'transparent', color: '#1a1714', width: 160, letterSpacing: '.08em',
              }}
            />
            <button type="submit" style={{
              border: 'none', borderLeft: '2px solid #1a1714', padding: '0 18px',
              background: '#3ddc97', color: '#1a1714',
              fontWeight: 900, fontSize: 16, cursor: 'pointer',
            }}>join →</button>
          </form>
        </div>

        {/* social proof */}
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 14, color: 'rgba(26,23,20,.55)', fontSize: 13, fontWeight: 600 }}>
          <div style={{ display: 'flex' }}>
            {FACES.map(({ color, mood }, i) => (
              <div key={i} style={{ marginLeft: i ? -10 : 0, border: '2px solid #fff7e8', borderRadius: 99 }}>
                <Face color={color} mood={mood}/>
              </div>
            ))}
          </div>
          loved by <strong style={{ color: '#1a1714' }}>2.4M+</strong> doodlers · play in browser, no signup
        </div>
      </div>

      {/* Right: canvas preview */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <LandingHeroCanvas/>
      </div>
    </section>
  );
}
