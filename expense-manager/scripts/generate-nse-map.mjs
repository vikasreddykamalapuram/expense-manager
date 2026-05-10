/**
 * generate-nse-map.mjs — Generates a comprehensive NSE equity symbol map
 * from the official NSE EQUITY_L.csv (all ~2300+ listed stocks).
 *
 * Creates mappings:
 *   - ISIN → NSE ticker (primary, most reliable)
 *   - Company name variations → NSE ticker (for broker imports)
 *   - Ticker identity mappings
 *
 * Source: https://archives.nseindia.com/content/equities/EQUITY_L.csv
 * Output: public/nse-symbol-map.json
 *
 * Usage: node scripts/generate-nse-map.mjs
 *
 * Run monthly or after NSE listing changes to keep the map current.
 */

import { writeFileSync } from 'fs';

const OUTPUT_FILE = 'public/nse-symbol-map.json';
const NSE_CSV_URL = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ─── Fetch official NSE equity list ───

async function fetchNseEquityList() {
  console.log(`Fetching NSE equity list from ${NSE_CSV_URL}...`);

  const resp = await fetch(NSE_CSV_URL, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/csv' },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) throw new Error(`NSE CSV fetch failed: ${resp.status}`);

  const csv = await resp.text();
  const lines = csv.split('\n').filter(l => l.trim());

  // Parse CSV: SYMBOL, NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
  const stocks = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < 7) continue;

    const symbol = cols[0];
    const name = cols[1];
    const series = cols[2];
    const isin = cols[6];

    // Only include EQ series (regular equity), skip BE/BZ/SM etc.
    if (series !== 'EQ') continue;
    if (!symbol || !isin || !isin.startsWith('INE')) continue;

    stocks.push({ symbol, name, isin });
  }

  console.log(`  Parsed ${stocks.length} EQ-series stocks from ${lines.length - 1} total rows`);
  return stocks;
}

// ─── Generate name variations for fuzzy matching ───

function generateNameVariations(name, symbol) {
  const variations = new Set();
  const upper = name.toUpperCase().trim();

  // Full name as-is
  variations.add(upper);

  // No spaces
  const noSpaces = upper.replace(/\s+/g, '');
  variations.add(noSpaces);

  // Remove common suffixes: LIMITED, LTD, PRIVATE, PVT
  const stripped = upper
    .replace(/\s+(PRIVATE\s+)?LIMITED$/i, '')
    .replace(/\s+LTD\.?$/i, '')
    .replace(/\s+PVT\.?$/i, '')
    .trim();
  variations.add(stripped);
  variations.add(stripped.replace(/\s+/g, ''));

  // Remove all parenthetical content: "(INDIA)", "(FORMERLY ...)"
  const noParen = stripped.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (noParen !== stripped) {
    variations.add(noParen);
    variations.add(noParen.replace(/\s+/g, ''));
  }

  // Truncated to 20 chars (Geojit truncates after removing spaces)
  const noSpacesStripped = stripped.replace(/\s+/g, '');
  if (noSpacesStripped.length > 20) {
    variations.add(noSpacesStripped.substring(0, 20));
  }

  // Handle & ↔ AND
  if (upper.includes('&')) {
    const withAnd = upper.replace(/&/g, 'AND');
    variations.add(withAnd);
    variations.add(withAnd.replace(/\s+/g, ''));
  }
  if (upper.includes(' AND ')) {
    const withAmp = upper.replace(/ AND /g, '&');
    variations.add(withAmp);
    variations.add(withAmp.replace(/\s+/g, ''));
  }

  // Alpha-only (remove all non-alphanumeric)
  variations.add(upper.replace(/[^A-Z0-9]/g, ''));

  // The symbol itself
  variations.add(symbol.toUpperCase());

  return [...variations].filter(v => v.length >= 2);
}

// ─── Main ───

async function main() {
  const stocks = await fetchNseEquityList();

  const isinMap = {};      // ISIN → ticker
  const nameMap = {};      // normalized name → ticker
  const tickerInfo = {};   // ticker → { isin, name }

  for (const { symbol, name, isin } of stocks) {
    // ISIN → ticker (authoritative, always overwrite)
    isinMap[isin] = symbol;

    // Ticker info
    tickerInfo[symbol] = { isin, name };

    // Name variations → ticker (first-write-wins to avoid collisions)
    const variations = generateNameVariations(name, symbol);
    for (const v of variations) {
      if (!nameMap[v]) {
        nameMap[v] = symbol;
      }
    }
  }

  const output = {
    version: 2,
    generatedAt: new Date().toISOString(),
    source: 'NSE EQUITY_L.csv (official)',
    stockCount: stocks.length,
    isinToTicker: isinMap,
    nameToTicker: nameMap,
    tickerInfo,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log(`\n✅ Generated ${OUTPUT_FILE}`);
  console.log(`   ${Object.keys(isinMap).length} ISIN mappings`);
  console.log(`   ${Object.keys(nameMap).length} name variations`);
  console.log(`   ${Object.keys(tickerInfo).length} ticker entries`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
