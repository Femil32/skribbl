import Link from 'next/link';

const NAV_LINKS = [
  { label: 'How it plays', href: '#how' },
  { label: 'Word packs',   href: '#packs' },
  { label: 'Modes',        href: '#modes' },
  { label: 'Stats',        href: '#stats' },
];

export default function LandingNav() {
  return (
    <nav
      className="sticky top-0 z-50 flex items-center gap-7"
      style={{
        background: '#fff7e8',
        borderBottom: '2px solid #1a1714',
        padding: '14px 36px',
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 no-underline text-[#1a1714]">
        <div
          style={{
            width: 32, height: 32, background: '#ff5a3c',
            border: '2.5px solid #1a1714', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 16, transform: 'rotate(-6deg)',
            boxShadow: '2px 3px 0 0 #1a1714',
            fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
          }}
        >s</div>
        <span style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-.02em' }}>skribbl</span>
        <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: 'rgba(26,23,20,.55)', marginLeft: 2, marginTop: 6 }}>v3.0</span>
      </Link>

      {/* Nav links */}
      <div className="flex gap-1 ml-4">
        {NAV_LINKS.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            style={{
              color: '#1a1714', textDecoration: 'none', fontSize: 14,
              fontWeight: 700, padding: '8px 12px', borderRadius: 10,
            }}
          >{label}</a>
        ))}
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        {/* Live count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: '"DM Mono", monospace', fontSize: 12, fontWeight: 700 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#2a8f4a', boxShadow: '0 0 0 3px rgba(42,143,74,.18)' }}/>
          <span><strong>4,218</strong> drawing now</span>
        </div>
        {/* Sign in */}
        <Link
          href="/lobby"
          style={{
            fontWeight: 800, fontSize: 14, color: '#1a1714', textDecoration: 'none',
            padding: '9px 14px', border: '2px solid #1a1714', borderRadius: 10,
            background: '#fffdf6',
          }}
        >sign in</Link>
        {/* Play CTA */}
        <Link
          href="/lobby"
          style={{
            fontWeight: 900, fontSize: 14, letterSpacing: '.02em',
            color: '#1a1714', textDecoration: 'none', padding: '10px 16px',
            border: '2.5px solid #1a1714', borderRadius: 12, background: '#ff5a3c',
            boxShadow: '3px 4px 0 0 #1a1714',
          }}
        >play free →</Link>
      </div>
    </nav>
  );
}
