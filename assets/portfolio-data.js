// ============================================================
// Portfolio data — single source of truth for the whole site.
// Add/adjust positions here and every page (holdings table,
// allocation, performance chart, stock detail) updates from it.
// ============================================================

// Each position: shares held, buy price per share, cost basis (shares × buy),
// sector (hand-tagged for 8 names), a one-line thesis, and a longer "take"
// shown on the per-stock detail page.
const STOCKS = {
  CMG: {
    name: "Chipotle Mexican Grill", shares: 365, buy: 35.23, cost: 12858.95,
    sector: "Consumer Discretionary",
    thesis: "New-store throughput (Chipotlanes) and pricing power without discounting keep unit economics ahead of the rest of fast casual.",
    take: "The featured research position and the anchor of the book. The bull case is the durability of those unit economics; the open question I'm watching is whether recently slowing revenue growth is a temporary reset or a new baseline.",
  },
  NKE: {
    name: "Nike", shares: 290, buy: 44.21, cost: 12820.90,
    sector: "Consumer Discretionary",
    thesis: "Direct-to-consumer mix shift and inventory normalization set up a margin-recovery story.",
    take: "A turnaround bet. China demand is the main swing factor, and I want the next couple of quarters to actually show the inventory reset landing in the margins before I'd add.",
  },
  SBUX: {
    name: "Starbucks", shares: 120, buy: 104.85, cost: 12582.00,
    sector: "Consumer Discretionary",
    thesis: "New leadership's turnaround plan — store simplification, faster throughput — is a real re-rating case if it works.",
    take: "The other turnaround bet, paired with NKE. Traffic trends have to stop slipping first; I'm treating the next earnings print as the first real checkpoint on the thesis.",
  },
  MCD: {
    name: "McDonald's", shares: 46, buy: 274.57, cost: 12630.22,
    sector: "Consumer Discretionary",
    thesis: "Held as the comp for CMG and SBUX: a mature, franchise-heavy model that's a useful benchmark for unit economics.",
    take: "Deliberately the boring one. It's in the book so I can tell whether CMG and SBUX are actually outperforming a mature operator or just moving with the whole category.",
  },
  AAPL: {
    name: "Apple", shares: 43, buy: 306.45, cost: 13177.35,
    sector: "Technology",
    thesis: "Services keep expanding operating margin even as hardware growth flattens.",
    take: "The large-cap stability anchor. Held for the services-margin story and to dampen the swings from the turnaround bets, not for any near-term catalyst.",
  },
  COST: {
    name: "Costco", shares: 14, buy: 941.03, cost: 13174.42,
    sector: "Consumer Staples",
    thesis: "Membership renewal rates and steady comps make this the “boring compounder” position.",
    take: "The most expensive stock in the book by share price, which is what made it feel risky — but the business itself is about as stable as it gets. A running lesson in separating price from actual risk.",
  },
  V: {
    name: "Visa", shares: 36, buy: 358.46, cost: 12904.56,
    sector: "Financials",
    thesis: "Network-effect economics on payments volume, with very little direct credit risk.",
    take: "A bet on the continued shift away from cash. Toll-booth economics — it takes a cut of volume without carrying the credit risk a lender would.",
  },
  DIS: {
    name: "Disney", shares: 130, buy: 97.18, cost: 12633.40,
    sector: "Communication Services",
    thesis: "Streaming profitability inflection plus parks pricing power make the bull case.",
    take: "The highest-conviction, highest-risk pick. Content-spend cycles and segment reporting complexity make it the hardest of the eight to model cleanly.",
  },
};

// Derived list for anything that just needs to iterate positions.
const POSITIONS = Object.entries(STOCKS).map(([symbol, s]) => ({
  symbol, shares: s.shares, cost: s.cost,
}));

// Cost basis of the whole book on day one (sum of the costs above).
const BASELINE_TOTAL = 102781.80;

// SPY's close on the baseline day (Jul 9, 2026), used as the S&P 500 proxy.
const SPY_BASELINE = 751.16;

// Weekly snapshots for the performance chart. One entry per recorded week —
// add a line each week with that week's portfolio value and SPY close. The
// chart normalizes both series to 100 at the first entry (growth of $100).
const SNAPSHOTS = [
  { label: "Jul 9", portfolio: 102781.80, spy: 751.16 },
  // { label: "Jul 16", portfolio: 0, spy: 0 },
];
