// Live quotes via the Finnhub free /quote endpoint (read-only, current price
// only). TODO: if this site gets real traffic, move the key behind a small
// server-side proxy or env var instead of shipping it in client-side JS —
// fine for now since it's a free, read-only key on a low-traffic personal
// project, but it is visible to anyone who views source.
const FINNHUB_API_KEY = "d982uu9r01qng2nqb2v0d982uu9r01qng2nqb2vg";

const POSITIONS = [
  { symbol: "CMG",  shares: 365, cost: 12858.95 },
  { symbol: "NKE",  shares: 290, cost: 12820.90 },
  { symbol: "SBUX", shares: 120, cost: 12582.00 },
  { symbol: "MCD",  shares: 46,  cost: 12630.22 },
  { symbol: "AAPL", shares: 43,  cost: 13177.35 },
  { symbol: "COST", shares: 14,  cost: 13174.42 },
  { symbol: "V",    shares: 36,  cost: 12904.56 },
  { symbol: "DIS",  shares: 130, cost: 12633.40 },
];

const BASELINE_TOTAL = 102781.80;
const SPY_BASELINE = 751.16;

function fetchQuote(symbol) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`;
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`Finnhub request failed for ${symbol}: ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (typeof data.c !== "number" || data.c === 0) throw new Error(`No live price for ${symbol}`);
      return data.c;
    });
}

function fmtUSD(n) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(n) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtSigned(n) {
  return `${n >= 0 ? "+" : ""}${fmtUSD(n)}`;
}

function initHoldingsLiveData() {
  const quoteEls = document.querySelectorAll(".live-quote");
  if (!quoteEls.length) return;

  const valuePromises = Array.from(quoteEls).map(el => {
    const symbol = el.dataset.symbol;
    const shares = parseFloat(el.dataset.shares);
    const cost = parseFloat(el.dataset.cost);
    return fetchQuote(symbol)
      .then(price => {
        const value = price * shares;
        const gain = value - cost;
        const gainPct = (gain / cost) * 100;
        el.textContent = `Now: ${fmtUSD(price)} · ${fmtSigned(gain)} (${fmtPct(gainPct)})`;
        el.classList.add(gain >= 0 ? "pos" : "neg");
        return value;
      })
      .catch(() => {
        el.textContent = "unable to load live data";
        return null;
      });
  });

  const totalEl = document.getElementById("liveTotalValue");
  const gainEl = document.getElementById("liveTotalGain");
  if (!totalEl || !gainEl) return;

  Promise.all(valuePromises).then(values => {
    if (values.some(v => v === null)) {
      totalEl.textContent = "unable to load live data";
      gainEl.textContent = "";
      return;
    }
    const total = values.reduce((sum, v) => sum + v, 0);
    const gain = total - BASELINE_TOTAL;
    const gainPct = (gain / BASELINE_TOTAL) * 100;
    totalEl.textContent = fmtUSD(total);
    gainEl.textContent = `${fmtSigned(gain)} (${fmtPct(gainPct)})`;
    gainEl.classList.add(gain >= 0 ? "pos" : "neg");
  });
}

function initPerformanceLiveRow() {
  const row = document.getElementById("liveRow");
  if (!row) return;

  const valueEl = document.getElementById("liveValue");
  const portReturnEl = document.getElementById("livePortfolioReturn");
  const spxReturnEl = document.getElementById("liveSpxReturn");
  const deltaEl = document.getElementById("liveDelta");

  const positionValues = Promise.all(
    POSITIONS.map(p => fetchQuote(p.symbol).then(price => price * p.shares))
  );
  const spyPrice = fetchQuote("SPY");

  Promise.all([positionValues, spyPrice])
    .then(([values, spyNow]) => {
      const portfolioValue = values.reduce((sum, v) => sum + v, 0);
      const portfolioReturn = ((portfolioValue - BASELINE_TOTAL) / BASELINE_TOTAL) * 100;
      const spxReturn = ((spyNow - SPY_BASELINE) / SPY_BASELINE) * 100;
      const delta = portfolioReturn - spxReturn;

      valueEl.textContent = fmtUSD(portfolioValue);

      portReturnEl.textContent = fmtPct(portfolioReturn);
      portReturnEl.classList.add(portfolioReturn >= 0 ? "pos" : "neg");

      spxReturnEl.textContent = fmtPct(spxReturn);
      spxReturnEl.classList.add(spxReturn >= 0 ? "pos" : "neg");

      deltaEl.textContent = fmtPct(delta);
      deltaEl.classList.add(delta >= 0 ? "pos" : "neg");
    })
    .catch(() => {
      [valueEl, portReturnEl, spxReturnEl, deltaEl].forEach(el => {
        el.textContent = "unable to load live data";
      });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  initHoldingsLiveData();
  initPerformanceLiveRow();
});
