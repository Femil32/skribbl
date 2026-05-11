import { render } from '@testing-library/react';
import LandingNav from '../LandingNav';
import LandingHero from '../LandingHero';
import LandingTicker from '../LandingTicker';
import LandingHowItPlays from '../LandingHowItPlays';
import LandingWordPacks from '../LandingWordPacks';
import LandingModes from '../LandingModes';
import LandingFeatures from '../LandingFeatures';
import LandingStats from '../LandingStats';
import LandingQuotes from '../LandingQuotes';
import LandingFinalCTA from '../LandingFinalCTA';
import LandingFooter from '../LandingFooter';

describe('Landing sections render without crashing', () => {
  it('renders Nav', () => { render(<LandingNav />); });
  it('renders Hero', () => { render(<LandingHero />); });
  it('renders Ticker', () => { render(<LandingTicker />); });
  it('renders HowItPlays', () => { render(<LandingHowItPlays />); });
  it('renders WordPacks', () => { render(<LandingWordPacks />); });
  it('renders Modes', () => { render(<LandingModes />); });
  it('renders Features', () => { render(<LandingFeatures />); });
  it('renders Stats', () => { render(<LandingStats />); });
  it('renders Quotes', () => { render(<LandingQuotes />); });
  it('renders FinalCTA', () => { render(<LandingFinalCTA />); });
  it('renders Footer', () => { render(<LandingFooter />); });
});
