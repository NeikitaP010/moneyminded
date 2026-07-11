// Weekly portfolio snapshot recorder.
//
// Run by .github/workflows/weekly-snapshot.yml on a schedule. Fetches live
// quotes for the 8 positions + SPY from Finnhub, computes the portfolio value,
// and appends one dated entry to assets/snapshots.json (which the growth chart
// reads). No-ops if a snapshot for today's date already exists.
//
// Keep POSITIONS in sync with STOCKS in assets/portfolio-data.js when holdings
// change. Requires Node 18+ (global fetch) and a FINNHUB_API_KEY env var.

import fs from "node:fs";

const KEY = process.env.FINNHUB_API_KEY;
if (!KEY) {
  console.error("Missing FINNHUB_API_KEY environment variable.");
  process.exit(1);
}

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

const SNAPSHOTS_PATH = "assets/snapshots.json";

async function quote(symbol) {
  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${KEY}`);
  if (!res.ok) throw new Error(`Quote request failed for ${symbol}: ${res.status}`);
  const data = await res.json();
  if (typeof data.c !== "number" || data.c === 0) throw new Error(`No live price for ${symbol}`);
  return data.c;
}

const round2 = n => Math.round(n * 100) / 100;

const positionValues = await Promise.all(
  POSITIONS.map(async p => (await quote(p.symbol)) * p.shares)
);
const portfolio = round2(positionValues.reduce((sum, v) => sum + v, 0));
const spy = round2(await quote("SPY"));

const now = new Date();
const isoDate = now.toISOString().slice(0, 10);
const label = now.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const store = JSON.parse(fs.readFileSync(SNAPSHOTS_PATH, "utf8"));
if (store.snapshots.some(s => s.date === isoDate)) {
  console.log(`Snapshot for ${isoDate} already exists — nothing to do.`);
  process.exit(0);
}

store.snapshots.push({ date: isoDate, label, portfolio, spy });
fs.writeFileSync(SNAPSHOTS_PATH, JSON.stringify(store, null, 2) + "\n");
console.log(`Appended snapshot ${isoDate}: portfolio ${portfolio}, SPY ${spy}`);
