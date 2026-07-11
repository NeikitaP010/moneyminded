// ============================================================
// Portfolio data — single source of truth for the whole site.
// Add/adjust positions here and every page (holdings table,
// allocation, performance chart, stock detail) updates from it.
// ============================================================

// Each position: shares held, buy price per share, cost basis (shares × buy),
// sector, a one-line thesis, a longer "take" (detail page), the risk named at
// entry, a scorecard status ("open" | "holding" | "confirmed" | "broke"), and
// the lesson once a thesis resolves. Update status/lesson as theses play out.
const STOCKS = {
  CMG: {
    name: "Chipotle Mexican Grill", shares: 365, buy: 35.23, cost: 12858.95,
    sector: "Consumer Discretionary",
    thesis: "New-store throughput (Chipotlanes) and pricing power without discounting keep unit economics ahead of the rest of fast casual.",
    take: "The featured research position and the anchor of the book. The bull case is the durability of those unit economics; the open question I'm watching is whether recently slowing revenue growth is a temporary reset or a new baseline.",
    risk: "Decelerating revenue growth turns out to be a new, lower baseline rather than a temporary reset.",
    status: "open", lesson: "",
  },
  NKE: {
    name: "Nike", shares: 290, buy: 44.21, cost: 12820.90,
    sector: "Consumer Discretionary",
    thesis: "Direct-to-consumer mix shift and inventory normalization set up a margin-recovery story.",
    take: "A turnaround bet. China demand is the main swing factor, and I want the next couple of quarters to actually show the inventory reset landing in the margins before I'd add.",
    risk: "China demand stays weak, or the inventory reset takes far longer than a couple of quarters to reach margins.",
    status: "open", lesson: "",
  },
  SBUX: {
    name: "Starbucks", shares: 120, buy: 104.85, cost: 12582.00,
    sector: "Consumer Discretionary",
    thesis: "New leadership's turnaround plan — store simplification, faster throughput — is a real re-rating case if it works.",
    take: "The other turnaround bet, paired with NKE. Traffic trends have to stop slipping first; I'm treating the next earnings print as the first real checkpoint on the thesis.",
    risk: "Traffic keeps slipping and the turnaround stalls before it shows up in the numbers.",
    status: "open", lesson: "",
  },
  MCD: {
    name: "McDonald's", shares: 46, buy: 274.57, cost: 12630.22,
    sector: "Consumer Discretionary",
    thesis: "Held as the comp for CMG and SBUX: a mature, franchise-heavy model that's a useful benchmark for unit economics.",
    take: "Deliberately the boring one. It's in the book so I can tell whether CMG and SBUX are actually outperforming a mature operator or just moving with the whole category.",
    risk: "As the benchmark, the risk is that it simply moves with the category and tells me little — or quietly outperforms the turnaround bets I was more excited about.",
    status: "open", lesson: "",
  },
  AAPL: {
    name: "Apple", shares: 43, buy: 306.45, cost: 13177.35,
    sector: "Technology",
    thesis: "Services keep expanding operating margin even as hardware growth flattens.",
    take: "The large-cap stability anchor. Held for the services-margin story and to dampen the swings from the turnaround bets, not for any near-term catalyst.",
    risk: "Hardware growth flattens faster than services margin can offset, or regulation pressures the services business.",
    status: "open", lesson: "",
  },
  COST: {
    name: "Costco", shares: 14, buy: 941.03, cost: 13174.42,
    sector: "Consumer Staples",
    thesis: "Membership renewal rates and steady comps make this the “boring compounder” position.",
    take: "The most expensive stock in the book by share price, which is what made it feel risky — but the business itself is about as stable as it gets. A running lesson in separating price from actual risk.",
    risk: "A rich valuation priced for perfection leaves little margin for even a small stumble in comps or renewals.",
    status: "open", lesson: "",
  },
  V: {
    name: "Visa", shares: 36, buy: 358.46, cost: 12904.56,
    sector: "Financials",
    thesis: "Network-effect economics on payments volume, with very little direct credit risk.",
    take: "A bet on the continued shift away from cash. Toll-booth economics — it takes a cut of volume without carrying the credit risk a lender would.",
    risk: "Regulatory pressure on interchange fees, or a faster-than-expected shift to alternative payment rails that bypass the network.",
    status: "open", lesson: "",
  },
  DIS: {
    name: "Disney", shares: 130, buy: 97.18, cost: 12633.40,
    sector: "Communication Services",
    thesis: "Streaming profitability inflection plus parks pricing power make the bull case.",
    take: "The highest-conviction, highest-risk pick. Content-spend cycles and segment reporting complexity make it the hardest of the eight to model cleanly.",
    risk: "The streaming profitability inflection slips, and content-spend cycles keep segment economics hard to model.",
    status: "open", lesson: "",
  },
};

// Derived list for anything that just needs to iterate positions.
const POSITIONS = Object.entries(STOCKS).map(([symbol, s]) => ({
  symbol, shares: s.shares, cost: s.cost,
}));

// Cost basis of the whole book on day one (sum of the costs above).
const BASELINE_TOTAL = 102781.80;

// Cash deposited to open the book. It funded the 8 opening buys, so recorded
// cash today derives to $0 (INITIAL_CASH − opening buy costs). The rebalance
// tool recomputes available cash from this plus the TRADES log.
const INITIAL_CASH = 102781.80;

// SPY's close on the baseline day (Jul 9, 2026), used as the S&P 500 proxy.
const SPY_BASELINE = 751.16;

// Weekly performance snapshots now live in assets/snapshots.json, appended
// automatically each week by the scheduled GitHub Action (scripts/snapshot.mjs)
// and read by the growth chart. Nothing to edit here.

// Trade journal — every buy/sell with the reasoning behind it, newest first
// on the page. Append a line per trade; action is "BUY" or "SELL". This is the
// dated decision record; the holdings page is the current snapshot.
const TRADES = [
  { date: "2026-07-09", action: "BUY", symbol: "CMG", shares: 365, price: 35.23,
    rationale: "The featured research pick and anchor of the book. Entered on the pricing-power-without-discounting thesis from the full equity report; the main risk I flagged going in is decelerating revenue growth." },
  { date: "2026-07-09", action: "BUY", symbol: "NKE", shares: 290, price: 44.21,
    rationale: "A turnaround bet on the direct-to-consumer mix shift and inventory reset. Bought knowing China demand is the swing factor and that it needs a couple of quarters to show up in margins." },
  { date: "2026-07-09", action: "BUY", symbol: "SBUX", shares: 120, price: 104.85,
    rationale: "The second turnaround bet, paired with NKE. Entered on the new-leadership store-simplification plan; the thesis hinges on traffic trends stabilizing first." },
  { date: "2026-07-09", action: "BUY", symbol: "MCD", shares: 46, price: 274.57,
    rationale: "Bought deliberately as the mature comp for CMG and SBUX — a benchmark to judge whether the turnaround names are actually outperforming or just moving with the category." },
  { date: "2026-07-09", action: "BUY", symbol: "AAPL", shares: 43, price: 306.45,
    rationale: "The large-cap stability anchor. Entered for the services-margin story and to dampen the swings from the turnaround positions, not for a near-term catalyst." },
  { date: "2026-07-09", action: "BUY", symbol: "COST", shares: 14, price: 941.03,
    rationale: "The 'boring compounder.' Bought for membership-renewal stability; noted at entry that the high share price made it feel riskier than the business actually is." },
  { date: "2026-07-09", action: "BUY", symbol: "V", shares: 36, price: 358.46,
    rationale: "A bet on the secular shift away from cash — toll-booth economics on payment volume with very little direct credit risk." },
  { date: "2026-07-09", action: "BUY", symbol: "DIS", shares: 130, price: 97.18,
    rationale: "The highest-conviction, highest-risk pick. Bought on the streaming-profitability inflection plus parks pricing power, aware it's the hardest of the eight to model cleanly." },
];
