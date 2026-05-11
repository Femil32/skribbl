import {
  LandingNav,
  LandingHero,
  LandingTicker,
  LandingHowItPlays,
  LandingWordPacks,
  LandingModes,
  LandingFeatures,
  LandingStats,
  LandingQuotes,
  LandingFinalCTA,
  LandingFooter,
} from '@/features/landing';

export default function Home() {
  return (
    <div style={{ background: '#fff7e8', color: '#1a1714', fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', minWidth: 1240 }}>
      <LandingNav/>
      <LandingHero/>
      <LandingTicker/>
      <LandingHowItPlays/>
      <LandingWordPacks/>
      <LandingModes/>
      <LandingFeatures/>
      <LandingStats/>
      <LandingQuotes/>
      <LandingFinalCTA/>
      <LandingFooter/>
    </div>
  );
}
