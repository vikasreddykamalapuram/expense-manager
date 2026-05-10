/**
 * Symbol Resolver — resolves any stock identifier to its NSE ticker symbol.
 *
 * Supports resolution by:
 *   1. ISIN (INExxxxxxxx) — most reliable, used by Geojit
 *   2. NSE ticker (direct match) — used by Zerodha, Groww, etc.
 *   3. Company name / broker-derived symbol — fuzzy matching
 *   4. BSE scrip code — for SBI Securities, HDFC Securities
 *
 * Uses static nse-symbol-map.json shipped with the app.
 * Falls back to the input symbol if no match is found.
 */

// ─── Types ──────────────────────────────────────────────

interface NseSymbolMap {
  version: number;
  isinToTicker: Record<string, string>;
  nameToTicker: Record<string, string>;
  tickerInfo: Record<string, { isin: string; name: string }>;
}

// ─── Lazy-loaded map ────────────────────────────────────

let symbolMap: NseSymbolMap | null = null;

async function loadMap(): Promise<NseSymbolMap> {
  if (symbolMap) return symbolMap;

  try {
    const url = `${import.meta.env.BASE_URL}nse-symbol-map.json`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) {
      symbolMap = await resp.json();
      return symbolMap!;
    }
  } catch {
    // Fallback: empty map
  }

  symbolMap = { version: 0, isinToTicker: {}, nameToTicker: {}, tickerInfo: {} };
  return symbolMap;
}

// Synchronous version using pre-loaded map (for migration/parser use)
let syncMap: NseSymbolMap | null = null;

export function loadMapSync(mapData: NseSymbolMap): void {
  syncMap = mapData;
  symbolMap = mapData;
}

function getMap(): NseSymbolMap {
  return syncMap || symbolMap || { version: 0, isinToTicker: {}, nameToTicker: {}, tickerInfo: {} };
}

// ─── Resolution Functions ───────────────────────────────

/**
 * Resolve an ISIN to its NSE ticker symbol.
 * ISINs are the most reliable identifier (unique per security).
 */
export async function resolveByIsin(isin: string): Promise<string | null> {
  if (!isin || !isin.startsWith('INE')) return null;
  const map = await loadMap();
  return map.isinToTicker[isin.trim().toUpperCase()] || null;
}

/** Synchronous ISIN resolution (for use in parsers) */
export function resolveByIsinSync(isin: string): string | null {
  if (!isin || !isin.startsWith('INE')) return null;
  const map = getMap();
  return map.isinToTicker[isin.trim().toUpperCase()] || null;
}

/**
 * Resolve a company name or broker-derived symbol to NSE ticker.
 * Tries multiple normalizations: exact, no-spaces, truncated, etc.
 */
export async function resolveByName(name: string): Promise<string | null> {
  if (!name) return null;
  const map = await loadMap();
  return resolveByNameInternal(name, map);
}

/** Synchronous name resolution */
export function resolveByNameSync(name: string): string | null {
  if (!name) return null;
  return resolveByNameInternal(name, getMap());
}

function resolveByNameInternal(name: string, map: NseSymbolMap): string | null {
  const upper = name.trim().toUpperCase();

  // 1. Direct match (already an NSE ticker)
  if (map.tickerInfo[upper]) return upper;

  // 2. Exact name match in nameToTicker
  if (map.nameToTicker[upper]) return map.nameToTicker[upper];

  // 3. Remove spaces and try
  const noSpaces = upper.replace(/\s+/g, '');
  if (map.nameToTicker[noSpaces]) return map.nameToTicker[noSpaces];

  // 4. Remove common suffixes and try
  const cleaned = upper
    .replace(/\s*(EQ|EQUITY|NEW|FV|F\.V\.?)\s*[\d/\-]*\s*/gi, ' ')
    .replace(/\s+\bRE\.?\b\s*[\d/\-]*\s*/gi, ' ')
    .replace(/\s+\bRS\.?\b\s*[\d/\-]*\s*/gi, ' ')
    .replace(/\s+(LIMITED|LTD\.?)\s*$/i, '')
    .trim();
  const cleanedNoSpaces = cleaned.replace(/\s+/g, '');
  if (map.nameToTicker[cleanedNoSpaces]) return map.nameToTicker[cleanedNoSpaces];

  // 5. Truncated to 20 chars (Geojit does this)
  if (cleanedNoSpaces.length > 20) {
    const truncated = cleanedNoSpaces.substring(0, 20);
    if (map.nameToTicker[truncated]) return map.nameToTicker[truncated];
  }

  // 6. Remove all non-alphanumeric chars
  const alphaOnly = upper.replace(/[^A-Z0-9]/g, '');
  if (map.nameToTicker[alphaOnly]) return map.nameToTicker[alphaOnly];

  return null;
}

/**
 * Resolve any input to NSE ticker — tries ISIN first, then name.
 * This is the primary resolution function used by broker parsers.
 */
export async function resolveSymbol(input: string, isin?: string): Promise<string> {
  // Try ISIN first (most reliable)
  if (isin) {
    const fromIsin = await resolveByIsin(isin);
    if (fromIsin) return fromIsin;
  }

  // Try name/symbol resolution
  const fromName = await resolveByName(input);
  if (fromName) return fromName;

  // Fallback: return input as-is (with basic normalization)
  return input
    .replace(/\s+/g, '')
    .substring(0, 20)
    .toUpperCase();
}

/** Synchronous version for parsers and migrations */
export function resolveSymbolSync(input: string, isin?: string): string {
  if (isin) {
    const fromIsin = resolveByIsinSync(isin);
    if (fromIsin) return fromIsin;
  }

  const fromName = resolveByNameSync(input);
  if (fromName) return fromName;

  return input
    .replace(/\s+/g, '')
    .substring(0, 20)
    .toUpperCase();
}

/**
 * Pre-load the symbol map. Call this at app startup.
 * After calling, sync functions (resolveByIsinSync, etc.) will work.
 */
export async function preloadSymbolMap(): Promise<void> {
  await loadMap();
}

/**
 * Get ticker info (name, ISIN) for a given ticker symbol.
 */
export async function getTickerInfo(ticker: string): Promise<{ isin: string; name: string } | null> {
  const map = await loadMap();
  return map.tickerInfo[ticker] || null;
}

/**
 * Check if a symbol is a known NSE ticker.
 */
export async function isKnownTicker(symbol: string): Promise<boolean> {
  const map = await loadMap();
  return symbol.toUpperCase() in map.tickerInfo;
}
