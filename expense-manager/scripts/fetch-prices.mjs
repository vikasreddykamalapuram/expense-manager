/**
 * fetch-prices.mjs — Server-side stock price fetcher for GitHub Actions.
 *
 * Fetches live prices from Yahoo Finance v8 API for all symbols found in
 * the app's stock transactions, writes to public/prices.json.
 *
 * Usage: node scripts/fetch-prices.mjs [--symbols RELIANCE,TCS,INFY]
 *
 * If no --symbols flag, reads existing prices.json to get the symbol list.
 * The app dynamically updates this list when users import new trades.
 */

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const OUTPUT_FILE = 'public/prices.json';

// Known Yahoo Finance symbol quirks for Indian stocks
const SYMBOL_OVERRIDES = {
  'BAJFINSERV': 'BAJAJFINSV',
  'ZOMATO': 'ETERNAL',
  'HBLPOWER': 'HBLENGINE',
  'TATAMOTORS': 'TMPV', // Demerged into TMPV (passenger) & TMCV (commercial) in 2025
};

function toYahooSymbol(symbol) {
  // If symbol already has exchange suffix (e.g., AAPL, VOD.L, 9988.HK), use as-is
  if (symbol.includes('.')) return symbol;
  // Apply Indian market overrides
  const mapped = SYMBOL_OVERRIDES[symbol] || symbol;
  // Default to NSE (.NS) for Indian stocks
  return `${mapped}.NS`;
}

async function fetchPrice(symbol) {
  const yahooSymbol = toYahooSymbol(symbol);
  const url = `${YAHOO_BASE}${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      // Try BSE as fallback only for Indian stocks (no dot in original symbol)
      if (!symbol.includes('.')) {
        const bseUrl = `${YAHOO_BASE}${encodeURIComponent(symbol + '.BO')}?interval=1d&range=1d`;
        const bseResp = await fetch(bseUrl, {
          headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000),
        });
        if (!bseResp.ok) throw new Error(`HTTP ${resp.status} for ${yahooSymbol}`);
        return parseYahooResponse(symbol, await bseResp.json());
      }
      throw new Error(`HTTP ${resp.status} for ${yahooSymbol}`);
    }

    return parseYahooResponse(symbol, await resp.json());
  } catch (err) {
    console.warn(`  ⚠ ${symbol}: ${err.message}`);
    return null;
  }
}

function parseYahooResponse(symbol, data) {
  try {
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const currentPrice = Number(meta.regularMarketPrice);
    const previousClose = Number(meta.regularMarketPreviousClose ?? meta.chartPreviousClose ?? meta.previousClose);
    const dayHigh = Number(meta.regularMarketDayHigh ?? meta.dayHigh ?? currentPrice);
    const dayLow = Number(meta.regularMarketDayLow ?? meta.dayLow ?? currentPrice);
    const open = Number(meta.regularMarketOpen ?? currentPrice);

    if (!isFinite(currentPrice) || currentPrice <= 0) return null;
    if (!isFinite(previousClose) || previousClose <= 0) return null;

    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
      symbol,
      price: round2(currentPrice),
      previousClose: round2(previousClose),
      open: round2(open),
      dayHigh: round2(isFinite(dayHigh) ? dayHigh : currentPrice),
      dayLow: round2(isFinite(dayLow) ? dayLow : currentPrice),
      change: round2(change),
      changePercent: round2(changePercent),
    };
  } catch {
    return null;
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function main() {
  const fs = await import('fs');
  const path = await import('path');

  // Collect symbols from ALL sources (union)
  const symbolSet = new Set();

  // Source 1: CLI --symbols flag (highest priority, for adding new symbols)
  const symbolsIdx = process.argv.indexOf('--symbols');
  if (symbolsIdx !== -1 && process.argv[symbolsIdx + 1]) {
    process.argv[symbolsIdx + 1].split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      .forEach(s => symbolSet.add(s));
    console.log(`CLI symbols: ${symbolSet.size}`);
  }

  // Source 2: stock-symbols.json manifest (NIFTY 50 + user-added)
  try {
    const manifest = JSON.parse(fs.readFileSync('public/stock-symbols.json', 'utf8'));
    const manifestSymbols = manifest.symbols || [];
    manifestSymbols.forEach(s => symbolSet.add(s));
    console.log(`Manifest symbols: ${manifestSymbols.length}`);
  } catch {
    // No manifest
  }

  // Source 3: existing prices.json (symbols already tracked)
  try {
    const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    const existingSymbols = Object.keys(existing.data || {});
    existingSymbols.forEach(s => symbolSet.add(s));
    console.log(`Existing prices.json symbols: ${existingSymbols.length}`);
  } catch {
    // No existing file
  }

  const symbols = [...symbolSet].sort();

  if (symbols.length === 0) {
    console.log('No symbols to fetch. Pass --symbols or ensure stock-symbols.json/prices.json exists.');
    process.exit(0);
  }

  console.log(`Fetching prices for ${symbols.length} symbols: ${symbols.join(', ')}`);

  const prices = {};
  let success = 0;
  let failed = 0;

  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    const result = await fetchPrice(sym);

    if (result) {
      prices[sym] = result;
      success++;
      console.log(`  ✓ ${sym}: ₹${result.price} (${result.change >= 0 ? '+' : ''}${result.changePercent}%)`);
    } else {
      failed++;
    }

    // Rate limit: 500ms between requests
    if (i < symbols.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const output = {
    data: prices,
    fetchedAt: new Date().toISOString(),
    marketStatus: isIndianMarketOpen() ? 'open' : 'closed',
    stats: { total: symbols.length, success, failed },
  };

  // Ensure output directory exists
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✅ Wrote ${success}/${symbols.length} prices to ${OUTPUT_FILE}`);
  if (failed > 0) console.log(`⚠ ${failed} symbols failed`);
}

function isIndianMarketOpen() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
