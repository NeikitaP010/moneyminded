// Live quotes via the Finnhub free API (read-only). Depends on the globals
// defined in portfolio-data.js (STOCKS, POSITIONS, BASELINE_TOTAL,
// SPY_BASELINE, TRADES), so that file must be loaded first.
//
// TODO: if this site gets real traffic, move the key behind a small
// server-side proxy or env var instead of shipping it in client-side JS —
// fine for now since it's a free, read-only key on a low-traffic personal
// project, but it is visible to anyone who views source.
const FINNHUB_API_KEY = "d982uu9r01qng2nqb2v0d982uu9r01qng2nqb2vg";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

// Absolute base URL of the /assets directory, derived from this script's own
// src so data files resolve correctly from any page depth.
const ASSETS_BASE = (function () {
  const s = document.currentScript;
  return s ? s.src.replace(/[^/]*$/, "") : "";
})();

// Weekly performance snapshots, appended by the scheduled GitHub Action
// (scripts/snapshot.mjs) into assets/snapshots.json. Falls back to the day-one
// baseline if the file can't be read.
function fetchSnapshots() {
  return fetch(`${ASSETS_BASE}snapshots.json`)
    .then(res => (res.ok ? res.json() : Promise.reject(new Error(res.status))))
    .then(data => (Array.isArray(data.snapshots) && data.snapshots.length
      ? data.snapshots
      : [{ date: "2026-07-09", label: "Jul 9", portfolio: BASELINE_TOTAL, spy: SPY_BASELINE }]))
    .catch(() => [{ date: "2026-07-09", label: "Jul 9", portfolio: BASELINE_TOTAL, spy: SPY_BASELINE }]);
}

// ---------- Fetch helpers ----------

// Returns the full quote object: c (current), d (day $ change),
// dp (day % change), pc (previous close), o/h/l, t (timestamp).
function fetchQuote(symbol) {
  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`;
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`Quote request failed for ${symbol}: ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (typeof data.c !== "number" || data.c === 0) throw new Error(`No live price for ${symbol}`);
      return data;
    });
}

// Basic financials (P/E, margins, 52-week range, beta, market cap, etc.).
// Some fields may be absent on the free tier — callers should tolerate nulls.
function fetchMetric(symbol) {
  const url = `${FINNHUB_BASE}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${FINNHUB_API_KEY}`;
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`Metric request failed for ${symbol}: ${res.status}`);
      return res.json();
    })
    .then(data => data.metric || {});
}

// Recent company news over the trailing two weeks.
function fetchNews(symbol) {
  const to = new Date();
  const from = new Date(to.getTime() - 14 * 24 * 3600 * 1000);
  const fmt = d => d.toISOString().slice(0, 10);
  const url = `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${FINNHUB_API_KEY}`;
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`News request failed for ${symbol}: ${res.status}`);
      return res.json();
    })
    .then(data => (Array.isArray(data) ? data : []));
}

// ---------- Formatters ----------

function fmtUSD(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(n) { return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`; }
function fmtSigned(n) { return `${n >= 0 ? "+" : ""}${fmtUSD(n)}`; }
function signClass(n) { return n >= 0 ? "pos" : "neg"; }

// ---------- Holdings page ----------

function initHoldingsPage() {
  const hasCards = document.querySelector(".live-quote");
  const hasTable = document.getElementById("breakdownBody");
  const hasAlloc = document.getElementById("allocPositions");
  if (!hasCards && !hasTable && !hasAlloc) return;

  const symbols = Object.keys(STOCKS);
  Promise.all(
    symbols.map(s => fetchQuote(s).then(q => ({ s, q })).catch(() => ({ s, q: null })))
  ).then(results => {
    const quotes = {};
    results.forEach(r => { quotes[r.s] = r.q; });
    populateCardQuotes(quotes);
    populateSummary(quotes);
    renderBreakdownTable(quotes);
    renderAllocation(quotes);
  });
}

function populateCardQuotes(quotes) {
  document.querySelectorAll(".live-quote").forEach(el => {
    const symbol = el.dataset.symbol;
    const q = quotes[symbol];
    if (!q) { el.textContent = "unable to load live data"; return; }
    el.textContent = `Now: ${fmtUSD(q.c)} · ${fmtSigned(q.d)} (${fmtPct(q.dp)}) today`;
    el.classList.add(signClass(q.d));
  });
}

function populateSummary(quotes) {
  const totalEl = document.getElementById("liveTotalValue");
  const gainEl = document.getElementById("liveTotalGain");
  if (!totalEl || !gainEl) return;

  const symbols = Object.keys(STOCKS);
  if (symbols.some(s => !quotes[s])) {
    totalEl.textContent = "unable to load live data";
    gainEl.textContent = "";
    return;
  }
  const total = symbols.reduce((sum, s) => sum + quotes[s].c * STOCKS[s].shares, 0);
  const dayChange = symbols.reduce((sum, s) => sum + quotes[s].d * STOCKS[s].shares, 0);
  const gain = total - BASELINE_TOTAL;
  const gainPct = (gain / BASELINE_TOTAL) * 100;
  const dayPct = (dayChange / (total - dayChange)) * 100;

  totalEl.textContent = fmtUSD(total);
  gainEl.innerHTML =
    `<span class="${signClass(gain)}">${fmtSigned(gain)} (${fmtPct(gainPct)})</span> all-time` +
    ` &nbsp;·&nbsp; <span class="${signClass(dayChange)}">${fmtSigned(dayChange)} (${fmtPct(dayPct)})</span> today`;
}

// --- Sortable breakdown table ---

let breakdownRows = [];
let breakdownSort = { key: "value", dir: "desc" };

function renderBreakdownTable(quotes) {
  const body = document.getElementById("breakdownBody");
  const foot = document.getElementById("breakdownFoot");
  if (!body) return;

  const totalValue = Object.keys(STOCKS)
    .reduce((sum, s) => sum + (quotes[s] ? quotes[s].c * STOCKS[s].shares : 0), 0);

  breakdownRows = Object.entries(STOCKS).map(([symbol, s]) => {
    const q = quotes[symbol];
    if (!q) {
      return { symbol, shares: s.shares, buy: s.buy, cost: s.cost,
        last: null, value: null, todayDollar: null, todayPct: null,
        totalDollar: null, totalPct: null, weight: null };
    }
    const value = q.c * s.shares;
    const todayDollar = q.d * s.shares;
    const totalDollar = value - s.cost;
    return {
      symbol, shares: s.shares, buy: s.buy, cost: s.cost,
      last: q.c, value, todayDollar, todayPct: q.dp,
      totalDollar, totalPct: (totalDollar / s.cost) * 100,
      weight: totalValue ? (value / totalValue) * 100 : null,
    };
  });

  // Header click-to-sort.
  document.querySelectorAll("#breakdownTable thead th[data-key]").forEach(th => {
    if (th.dataset.bound) return;
    th.dataset.bound = "1";
    th.classList.add("sortable");
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (breakdownSort.key === key) {
        breakdownSort.dir = breakdownSort.dir === "asc" ? "desc" : "asc";
      } else {
        breakdownSort = { key, dir: key === "symbol" ? "asc" : "desc" };
      }
      drawBreakdownBody();
    });
  });

  drawBreakdownBody();

  // Totals row (unaffected by sort).
  if (foot) {
    const anyMissing = Object.keys(STOCKS).some(s => !quotes[s]);
    const totalCost = BASELINE_TOTAL;
    const totalDay = Object.keys(STOCKS).reduce((sum, s) => sum + (quotes[s] ? quotes[s].d * STOCKS[s].shares : 0), 0);
    const totalGain = totalValue - totalCost;
    const dayBasis = totalValue - totalDay;
    const cells = anyMissing
      ? `<td colspan="11">Totals unavailable — some live prices didn't load</td>`
      : [
          `<td>Total</td>`,
          `<td class="num"></td>`,
          `<td class="num"></td>`,
          `<td class="num">${fmtUSD(totalCost)}</td>`,
          `<td class="num"></td>`,
          `<td class="num">${fmtUSD(totalValue)}</td>`,
          `<td class="num ${signClass(totalDay)}">${fmtSigned(totalDay)}</td>`,
          `<td class="num ${signClass(totalDay)}">${fmtPct((totalDay / dayBasis) * 100)}</td>`,
          `<td class="num ${signClass(totalGain)}">${fmtSigned(totalGain)}</td>`,
          `<td class="num ${signClass(totalGain)}">${fmtPct((totalGain / totalCost) * 100)}</td>`,
          `<td class="num">100%</td>`,
        ].join("");
    foot.innerHTML = `<tr>${cells}</tr>`;
  }
}

function drawBreakdownBody() {
  const body = document.getElementById("breakdownBody");
  if (!body) return;
  const { key, dir } = breakdownSort;
  const sorted = [...breakdownRows].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (av === null) return 1;      // missing data always sinks to the bottom
    if (bv === null) return -1;
    if (typeof av === "string") return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return dir === "asc" ? av - bv : bv - av;
  });

  body.innerHTML = sorted.map(r => {
    if (r.last === null) {
      return `<tr>
        <td><a href="stock.html?symbol=${r.symbol}">${r.symbol}</a></td>
        <td class="num">${r.shares}</td>
        <td class="num">${fmtUSD(r.buy)}</td>
        <td class="num">${fmtUSD(r.cost)}</td>
        <td class="num" colspan="7">unable to load live data</td>
      </tr>`;
    }
    return `<tr>
      <td><a href="stock.html?symbol=${r.symbol}">${r.symbol}</a></td>
      <td class="num">${r.shares}</td>
      <td class="num">${fmtUSD(r.buy)}</td>
      <td class="num">${fmtUSD(r.cost)}</td>
      <td class="num">${fmtUSD(r.last)}</td>
      <td class="num">${fmtUSD(r.value)}</td>
      <td class="num ${signClass(r.todayDollar)}">${fmtSigned(r.todayDollar)}</td>
      <td class="num ${signClass(r.todayPct)}">${fmtPct(r.todayPct)}</td>
      <td class="num ${signClass(r.totalDollar)}">${fmtSigned(r.totalDollar)}</td>
      <td class="num ${signClass(r.totalPct)}">${fmtPct(r.totalPct)}</td>
      <td class="num">${r.weight.toFixed(1)}%</td>
    </tr>`;
  }).join("");

  document.querySelectorAll("#breakdownTable thead th[data-key]").forEach(th => {
    th.classList.toggle("sorted-asc", th.dataset.key === key && dir === "asc");
    th.classList.toggle("sorted-desc", th.dataset.key === key && dir === "desc");
  });
}

// --- Allocation bars (by position and by sector) ---

function renderAllocation(quotes) {
  const posEl = document.getElementById("allocPositions");
  const secEl = document.getElementById("allocSectors");
  if (!posEl && !secEl) return;

  const symbols = Object.keys(STOCKS);
  if (symbols.some(s => !quotes[s])) {
    if (posEl) posEl.textContent = "unable to load live data";
    if (secEl) secEl.textContent = "unable to load live data";
    return;
  }

  const values = {};
  let total = 0;
  symbols.forEach(s => { values[s] = quotes[s].c * STOCKS[s].shares; total += values[s]; });

  if (posEl) {
    const rows = symbols
      .map(s => ({ label: s, pct: (values[s] / total) * 100 }))
      .sort((a, b) => b.pct - a.pct);
    posEl.innerHTML = allocBars(rows);
  }

  if (secEl) {
    const bySector = {};
    symbols.forEach(s => {
      const sec = STOCKS[s].sector;
      bySector[sec] = (bySector[sec] || 0) + values[s];
    });
    const rows = Object.entries(bySector)
      .map(([label, v]) => ({ label, pct: (v / total) * 100 }))
      .sort((a, b) => b.pct - a.pct);
    secEl.innerHTML = allocBars(rows);
  }
}

function allocBars(rows) {
  return rows.map(r => `
    <div class="alloc-row">
      <span class="alloc-label">${r.label}</span>
      <span class="alloc-track"><span class="alloc-fill" style="width:${r.pct.toFixed(1)}%"></span></span>
      <span class="alloc-pct">${r.pct.toFixed(1)}%</span>
    </div>`).join("");
}

// ---------- Performance page (live row + growth chart) ----------

function initPerformancePage() {
  const row = document.getElementById("liveRow");
  const chartEl = document.getElementById("growthChart");
  if (!row && !chartEl) return;

  const symbols = Object.keys(STOCKS);
  Promise.all([
    Promise.all(symbols.map(s => fetchQuote(s).then(q => q.c * STOCKS[s].shares).catch(() => null))),
    fetchQuote("SPY").then(q => q.c).catch(() => null),
    chartEl ? fetchSnapshots() : Promise.resolve(null),
  ]).then(([values, spyNow, snaps]) => {
    const anyMissing = values.some(v => v === null) || spyNow === null;
    const portfolioValue = anyMissing ? null : values.reduce((sum, v) => sum + v, 0);

    if (row) populateLiveRow(portfolioValue, spyNow);
    if (chartEl) renderGrowthChart(snaps, portfolioValue, spyNow);
  });
}

function populateLiveRow(portfolioValue, spyNow) {
  const valueEl = document.getElementById("liveValue");
  const portEl = document.getElementById("livePortfolioReturn");
  const spxEl = document.getElementById("liveSpxReturn");
  const deltaEl = document.getElementById("liveDelta");

  if (portfolioValue === null || spyNow === null) {
    [valueEl, portEl, spxEl, deltaEl].forEach(el => { if (el) el.textContent = "unable to load live data"; });
    return;
  }
  const portReturn = ((portfolioValue - BASELINE_TOTAL) / BASELINE_TOTAL) * 100;
  const spxReturn = ((spyNow - SPY_BASELINE) / SPY_BASELINE) * 100;
  const delta = portReturn - spxReturn;

  valueEl.textContent = fmtUSD(portfolioValue);
  portEl.textContent = fmtPct(portReturn); portEl.classList.add(signClass(portReturn));
  spxEl.textContent = fmtPct(spxReturn); spxEl.classList.add(signClass(spxReturn));
  deltaEl.textContent = fmtPct(delta); deltaEl.classList.add(signClass(delta));
}

// Growth-of-$100: portfolio and SPY both indexed to 100 at the first snapshot.
function renderGrowthChart(snaps, portfolioValue, spyNow) {
  const el = document.getElementById("growthChart");
  if (!el) return;
  if (!snaps || !snaps.length) { el.textContent = "No snapshots recorded yet."; return; }

  const base = snaps[0];
  const points = snaps.map(s => ({
    label: s.label,
    port: (s.portfolio / base.portfolio) * 100,
    spy: (s.spy / base.spy) * 100,
  }));
  if (portfolioValue !== null && spyNow !== null) {
    points.push({
      label: "Now",
      port: (portfolioValue / base.portfolio) * 100,
      spy: (spyNow / base.spy) * 100,
    });
  }

  if (points.length < 2) {
    el.innerHTML = `<p class="chart-note">Chart fills in as weekly snapshots accumulate — one data point so far. Live prices didn't load, so the “Now” point is hidden.</p>`;
    return;
  }

  const W = 820, H = 380, padL = 56, padR = 18, padT = 22, padB = 40;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const all = points.flatMap(p => [p.port, p.spy]);
  let min = Math.min(...all), max = Math.max(...all);
  const span = Math.max(max - min, 1);
  min -= span * 0.12; max += span * 0.12;

  const x = i => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = v => padT + (1 - (v - min) / (max - min)) * plotH;

  const line = key => points.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const dots = (key, color) => points.map((p, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(p[key]).toFixed(1)}" r="3" fill="${color}"/>`).join("");

  // Horizontal gridlines + y labels near the top, middle (100), and bottom.
  const ticks = [max - (max - min) * 0.1, 100, min + (max - min) * 0.1]
    .filter((v, i, a) => a.indexOf(v) === i);
  const grid = ticks.map(v => `
    <line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${W - padR}" y2="${y(v).toFixed(1)}" stroke="rgba(201,154,58,0.15)"/>
    <text x="${padL - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="chart-axis">${v.toFixed(1)}</text>`).join("");

  const xLabels = points.map((p, i) =>
    `<text x="${x(i).toFixed(1)}" y="${H - 14}" text-anchor="middle" class="chart-axis">${p.label}</text>`).join("");

  const PORT = "#c99a3a", SPY = "#a9a693";
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Portfolio vs S&P 500 growth of $100">
      ${grid}
      <polyline fill="none" stroke="${SPY}" stroke-width="2" stroke-dasharray="5 4" points="${line("spy")}"/>
      <polyline fill="none" stroke="${PORT}" stroke-width="2.5" points="${line("port")}"/>
      ${dots("spy", SPY)}${dots("port", PORT)}
      ${xLabels}
      <g class="chart-legend">
        <rect x="${padL}" y="${padT - 6}" width="14" height="3" fill="${PORT}"/>
        <text x="${padL + 20}" y="${padT - 1}" class="chart-axis">Portfolio</text>
        <rect x="${padL + 96}" y="${padT - 6}" width="14" height="3" fill="${SPY}"/>
        <text x="${padL + 116}" y="${padT - 1}" class="chart-axis">S&amp;P 500 (SPY)</text>
      </g>
    </svg>
    <p class="chart-note">Growth of $100 invested on ${base.label}. Both lines start at 100; the “Now” point updates live on each page load.</p>`;
}

// ---------- Thesis scorecard ----------

const SCORE_STATUS = {
  open:      { label: "Open · too early", cls: "open" },
  holding:   { label: "On track",         cls: "good" },
  confirmed: { label: "Confirmed",        cls: "good" },
  broke:     { label: "Broke",            cls: "bad" },
};

function initScorecard() {
  const el = document.getElementById("scorecard");
  if (!el) return;

  // Tally statuses for the summary line.
  const counts = { open: 0, holding: 0, confirmed: 0, broke: 0 };
  Object.values(STOCKS).forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
  const tallyEl = document.getElementById("scoreTally");
  if (tallyEl) {
    tallyEl.innerHTML = `
      <div class="stat"><div class="k">Theses Tracked</div><div class="v">${Object.keys(STOCKS).length}</div></div>
      <div class="stat"><div class="k">On Track</div><div class="v">${counts.holding + counts.confirmed}</div></div>
      <div class="stat"><div class="k">Broke</div><div class="v">${counts.broke}</div></div>
      <div class="stat"><div class="k">Still Open</div><div class="v">${counts.open}</div></div>`;
  }

  el.innerHTML = Object.entries(STOCKS).map(([symbol, s]) => {
    const st = SCORE_STATUS[s.status] || SCORE_STATUS.open;
    const verdict = s.status === "open"
      ? "Tracking — bought Jul 9, 2026. Too early to judge; the verdict lands when the thesis is tested."
      : escapeHtml(s.lesson || "Resolved.");
    const lesson = s.lesson ? escapeHtml(s.lesson) : "Fills in once the thesis resolves.";
    return `
      <div class="score">
        <div class="score__head">
          <a class="score__symbol" href="holdings/stock.html?symbol=${symbol}">${symbol}</a>
          <span class="score__name">${escapeHtml(s.name)}</span>
          <span class="score__status ${st.cls}">${st.label}</span>
        </div>
        <div class="score__row"><span class="score__k">Thesis</span><span class="score__v">${escapeHtml(s.thesis)}</span></div>
        <div class="score__row"><span class="score__k">Risk named at entry</span><span class="score__v">${escapeHtml(s.risk)}</span></div>
        <div class="score__row"><span class="score__k">Verdict</span><span class="score__v">${verdict}</span></div>
        <div class="score__row"><span class="score__k">Lesson</span><span class="score__v">${lesson}</span></div>
      </div>`;
  }).join("");
}

// ---------- Trade journal ----------

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

// Format a "YYYY-MM-DD" string without going through Date() (avoids timezone
// shifting the day).
function formatTradeDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function initJournal() {
  const el = document.getElementById("journal");
  if (!el) return;

  if (typeof TRADES === "undefined" || !TRADES.length) {
    el.innerHTML = `<p class="post-body" style="color:var(--text-lo)">No trades recorded yet.</p>`;
    const statsEmpty = document.getElementById("journalStats");
    if (statsEmpty) statsEmpty.innerHTML = "";
    return;
  }

  // Summary stats.
  const statsEl = document.getElementById("journalStats");
  if (statsEl) {
    const buys = TRADES.filter(t => t.action === "BUY");
    const sells = TRADES.filter(t => t.action === "SELL");
    const invested = buys.reduce((sum, t) => sum + t.shares * t.price, 0);
    const proceeds = sells.reduce((sum, t) => sum + t.shares * t.price, 0);
    const opened = TRADES.reduce((min, t) => (t.date < min ? t.date : min), TRADES[0].date);
    const net = invested - proceeds;
    statsEl.innerHTML = `
      <div class="stat"><div class="k">Trades Logged</div><div class="v">${TRADES.length}</div></div>
      <div class="stat"><div class="k">Net Invested</div><div class="v">${fmtUSD(net)}</div></div>
      <div class="stat"><div class="k">Buys / Sells</div><div class="v">${buys.length} / ${sells.length}</div></div>
      <div class="stat"><div class="k">Opened</div><div class="v">${formatTradeDate(opened)}</div></div>`;
  }

  // Group trades by date, newest date first; keep entry order within a date.
  const byDate = {};
  const order = [];
  TRADES.forEach(t => {
    if (!byDate[t.date]) { byDate[t.date] = []; order.push(t.date); }
    byDate[t.date].push(t);
  });
  order.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  el.innerHTML = order.map(date => {
    const rows = byDate[date].map(t => {
      const cls = t.action === "SELL" ? "sell" : "buy";
      const total = t.shares * t.price;
      return `
        <div class="trade ${cls}">
          <div class="trade__head">
            <span class="trade__action ${cls}">${t.action}</span>
            <a class="trade__symbol" href="holdings/stock.html?symbol=${t.symbol}">${t.symbol}</a>
            <span class="trade__detail">${t.shares} sh @ ${fmtUSD(t.price)} = ${fmtUSD(total)}</span>
          </div>
          <p class="trade__why">${escapeHtml(t.rationale)}</p>
        </div>`;
    }).join("");
    return `<p class="section-label">${formatTradeDate(date)}</p>${rows}`;
  }).join("");
}

// ---------- Per-stock detail page ----------

function initStockDetail() {
  const root = document.getElementById("stockDetail");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const symbol = (params.get("symbol") || "").toUpperCase();
  const s = STOCKS[symbol];

  if (!s) {
    root.innerHTML = `<p class="post-body">Unknown ticker. <a href="index.html">Back to holdings →</a></p>`;
    return;
  }

  // Static identity from portfolio data.
  setText("sdName", s.name);
  setText("sdTicker", symbol);
  setText("sdSector", s.sector);
  setText("sdPosition", `${s.shares} sh @ ${fmtUSD(s.buy)} · cost basis ${fmtUSD(s.cost)}`);
  setText("sdThesis", s.thesis);
  setText("sdTake", s.take);
  document.title = `${symbol} — ${s.name} · moneyminded`;

  // Live quote + position P&L.
  fetchQuote(symbol).then(q => {
    const value = q.c * s.shares;
    const totalGain = value - s.cost;
    setText("sdPrice", fmtUSD(q.c));
    setSigned("sdDayChange", q.d, `${fmtSigned(q.d)} (${fmtPct(q.dp)}) today`);
    setText("sdValue", fmtUSD(value));
    setSigned("sdTotalGain", totalGain, `${fmtSigned(totalGain)} (${fmtPct((totalGain / s.cost) * 100)})`);
  }).catch(() => {
    ["sdPrice", "sdDayChange", "sdValue", "sdTotalGain"].forEach(id => setText(id, "unable to load"));
  });

  // Key metrics.
  fetchMetric(symbol).then(m => {
    const hi = m["52WeekHigh"], lo = m["52WeekLow"];
    setText("mRange", (hi != null && lo != null) ? `${fmtUSD(lo)} – ${fmtUSD(hi)}` : "—");
    const pe = m.peTTM ?? m.peNormalizedAnnual;
    setText("mPE", pe != null ? pe.toFixed(1) : "—");
    setText("mMargin", m.netProfitMarginTTM != null ? `${m.netProfitMarginTTM.toFixed(1)}%` : "—");
    setText("mBeta", m.beta != null ? m.beta.toFixed(2) : "—");
    setText("mCap", m.marketCapitalization != null ? `$${(m.marketCapitalization / 1000).toFixed(1)}B` : "—");
    setText("mYield", m.dividendYieldIndicatedAnnual != null ? `${m.dividendYieldIndicatedAnnual.toFixed(2)}%` : "—");
  }).catch(() => {
    ["mRange", "mPE", "mMargin", "mBeta", "mCap", "mYield"].forEach(id => setText(id, "—"));
  });

  // Recent news.
  const newsEl = document.getElementById("sdNews");
  if (newsEl) {
    fetchNews(symbol).then(items => {
      if (!items.length) { newsEl.innerHTML = `<p class="post-body" style="color:var(--text-lo)">No recent headlines.</p>`; return; }
      newsEl.innerHTML = items.slice(0, 5).map(n => {
        const date = new Date(n.datetime * 1000).toISOString().slice(0, 10);
        return `<a class="news-item" href="${n.url}" target="_blank" rel="noopener">
          <span class="news-headline">${escapeHtml(n.headline)}</span>
          <span class="news-meta">${escapeHtml(n.source || "")} · ${date}</span>
        </a>`;
      }).join("");
    }).catch(() => {
      newsEl.innerHTML = `<p class="post-body" style="color:var(--text-lo)">Unable to load recent news.</p>`;
    });
  }
}

function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function setSigned(id, n, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.add(signClass(n));
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Boot ----------

document.addEventListener("DOMContentLoaded", () => {
  initHoldingsPage();
  initPerformancePage();
  initStockDetail();
  initJournal();
  initScorecard();
});
