// Monthly dividend-received recorder.
//
// Run by .github/workflows/monthly-dividends.yml. For each holding it pulls
// dated dividend events from Yahoo Finance's free public chart API and appends
// any whose ex-date falls on/after the portfolio open date to
// assets/dividends.json (which the dividends page reads).
//
// Design for observability: if Yahoo can't be reached / returns a broken
// response for any holding, the script exits non-zero so the Action fails
// loudly (email + auto-opened issue) and writes NOTHING — the data is never
// corrupted. A quiet month with no new dividends is a normal success and just
// advances "lastChecked". Requires Node 18+ (global fetch).
//
// Keep POSITIONS in sync with STOCKS in assets/portfolio-data.js.

import fs from "node:fs";

const POSITIONS = [
  { symbol: "CMG", shares: 365 },
  { symbol: "NKE", shares: 290 },
  { symbol: "SBUX", shares: 120 },
  { symbol: "MCD", shares: 46 },
  { symbol: "AAPL", shares: 43 },
  { symbol: "COST", shares: 14 },
  { symbol: "V", shares: 36 },
  { symbol: "DIS", shares: 130 },
];

const PATH = "assets/dividends.json";
const store = JSON.parse(fs.readFileSync(PATH, "utf8"));
const OPEN_DATE = store.openDate || "2026-07-09";
const openEpoch = Math.floor(new Date(`${OPEN_DATE}T00:00:00Z`).getTime() / 1000);
const nowEpoch = Math.floor(Date.now() / 1000);

async function fetchDividends(symbol, p1, p2) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}` +
    `?period1=${p1}&period2=${p2}&interval=1d&events=div`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const result = data && data.chart && data.chart.result && data.chart.result[0];
      if (!result) throw new Error("unexpected response shape");
      return Object.values(result.events && result.events.dividends ? result.events.dividends : {});
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

const existing = new Set(store.dividends.map(d => `${d.symbol}|${d.date}`));
let added = 0;
let errors = 0;

for (const { symbol, shares } of POSITIONS) {
  let events;
  try {
    events = await fetchDividends(symbol, openEpoch, nowEpoch + 86400);
  } catch (err) {
    console.error(`ERROR fetching ${symbol}: ${err.message}`);
    errors++;
    continue;
  }
  for (const ev of events) {
    if (typeof ev.amount !== "number" || typeof ev.date !== "number") continue;
    if (ev.date < openEpoch || ev.date > nowEpoch) continue; // only after open, on/before today
    const iso = new Date(ev.date * 1000).toISOString().slice(0, 10);
    const key = `${symbol}|${iso}`;
    if (existing.has(key)) continue;
    store.dividends.push({ date: iso, symbol, shares, perShare: Math.round(ev.amount * 10000) / 10000 });
    existing.add(key);
    added++;
    console.log(`+ ${symbol} ex-${iso} $${ev.amount}/sh x ${shares}`);
  }
}

if (errors > 0) {
  console.error(`Yahoo fetch failed for ${errors} holding(s). Nothing written — record manually and re-run.`);
  process.exit(1);
}

// Sanity probe: MCD has paid a dividend every quarter for decades. If the feed
// returns none over a 2-year window, Yahoo's dividend data is broken even though
// the requests "succeeded" — fail loudly rather than silently logging nothing.
try {
  const probe = await fetchDividends("MCD", nowEpoch - 2 * 365 * 86400, nowEpoch);
  if (!probe.length) {
    console.error("Sanity check failed: no MCD dividends found over 2 years — Yahoo's dividend feed looks broken. Nothing written.");
    process.exit(1);
  }
} catch (err) {
  console.error(`Sanity probe failed: ${err.message}. Nothing written.`);
  process.exit(1);
}

store.dividends.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
store.lastChecked = new Date().toISOString().slice(0, 10);
fs.writeFileSync(PATH, JSON.stringify(store, null, 2) + "\n");
console.log(`Done. Added ${added} dividend(s). lastChecked=${store.lastChecked}`);
