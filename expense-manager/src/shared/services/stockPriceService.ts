import { PortfolioHolding, StockExchange } from '../types';

// ─── Types ──────────────────────────────────────────────

export interface StockPrice {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  lastUpdated: string;
  source: 'yahoo' | 'cache';
}

interface PriceCache {
  price: StockPrice;
  cachedAt: number;
}

// ─── Constants ──────────────────────────────────────────

const CACHE_KEY = 'em_stock_prices';
const RATE_LIMIT_WINDOW = 10_000; // 10 seconds
const MAX_CALLS_PER_WINDOW = 5;
const BATCH_DELAY_MS = 2_000;
const MARKET_CACHE_TTL = 15 * 60 * 1000; // 15 min
const OFF_MARKET_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

// Rate limiter state
const callTimestamps: number[] = [];

// ─── Cache Helpers ──────────────────────────────────────

function loadCache(): Record<string, PriceCache> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, PriceCache>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function isIndianMarketOpen(): boolean {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const ist = new Date(utcMs + 5.5 * 60 * 60_000);
  const day = ist.getDay();
  if (day === 0 || day === 6) return false; // weekend
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  return timeInMinutes >= 9 * 60 + 15 && timeInMinutes <= 15 * 60 + 30;
}

function isCacheValid(entry: PriceCache): boolean {
  const ttl = isIndianMarketOpen() ? MARKET_CACHE_TTL : OFF_MARKET_CACHE_TTL;
  return Date.now() - entry.cachedAt < ttl;
}

export function getCachedPrice(symbol: string): StockPrice | null {
  const cache = loadCache();
  const entry = cache[symbol];
  if (!entry) return null;
  if (isCacheValid(entry)) return entry.price;
  // Return stale cache with source marker
  return { ...entry.price, source: 'cache' };
}

export function cachePrice(symbol: string, price: StockPrice): void {
  const cache = loadCache();
  cache[symbol] = { price, cachedAt: Date.now() };
  saveCache(cache);
}

// ─── Rate Limiting ──────────────────────────────────────

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  // Remove old timestamps
  while (callTimestamps.length > 0 && now - callTimestamps[0] > RATE_LIMIT_WINDOW) {
    callTimestamps.shift();
  }
  if (callTimestamps.length >= MAX_CALLS_PER_WINDOW) {
    const waitMs = RATE_LIMIT_WINDOW - (now - callTimestamps[0]) + 100;
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  callTimestamps.push(Date.now());
}

// ─── Symbol Mapping ─────────────────────────────────────

function toYahooSymbol(symbol: string, exchange: StockExchange): string {
  // Clean symbol: remove spaces, special chars
  const clean = symbol.replace(/\s+/g, '').replace(/[^A-Za-z0-9&-]/g, '');
  const suffix = exchange === 'BSE' ? '.BO' : '.NS';
  return `${clean}${suffix}`;
}

// ─── Response Validation ────────────────────────────────

function validatePriceResponse(data: unknown, symbol: string): StockPrice | null {
  try {
    if (typeof data !== 'object' || data === null) return null;
    const chart = (data as Record<string, unknown>).chart;
    if (typeof chart !== 'object' || chart === null) return null;

    const result = (chart as Record<string, unknown>).result;
    if (!Array.isArray(result) || result.length === 0) return null;

    const entry = result[0] as Record<string, unknown>;
    const meta = entry.meta as Record<string, unknown> | undefined;
    if (!meta) return null;

    const currentPrice = Number(meta.regularMarketPrice);
    const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose);
    const dayHigh = Number(meta.regularMarketDayHigh ?? meta.dayHigh ?? currentPrice);
    const dayLow = Number(meta.regularMarketDayLow ?? meta.dayLow ?? currentPrice);

    // Validate reasonable ranges
    if (!isFinite(currentPrice) || currentPrice <= 0) return null;
    if (!isFinite(previousClose) || previousClose <= 0) return null;

    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    // Sanity check: change percent should be within -100 to +500
    if (changePercent < -100 || changePercent > 500) return null;

    return {
      symbol,
      currentPrice: Math.round(currentPrice * 100) / 100,
      previousClose: Math.round(previousClose * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      dayHigh: Math.round((isFinite(dayHigh) ? dayHigh : currentPrice) * 100) / 100,
      dayLow: Math.round((isFinite(dayLow) ? dayLow : currentPrice) * 100) / 100,
      lastUpdated: new Date().toISOString(),
      source: 'yahoo',
    };
  } catch {
    return null;
  }
}

// ─── Fetch Functions ────────────────────────────────────

export async function fetchStockPrice(
  symbol: string,
  exchange: StockExchange
): Promise<StockPrice | null> {
  // Check cache first
  const cached = getCachedPrice(symbol);
  if (cached && cached.source !== 'cache') return cached;

  await waitForRateLimit();

  const yahooSymbol = toYahooSymbol(symbol, exchange);
  const yahooUrl = `${YAHOO_BASE}${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
  const proxyUrl = `${CORS_PROXY}${encodeURIComponent(yahooUrl)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data: unknown = await response.json();
    const price = validatePriceResponse(data, symbol);

    if (price) {
      cachePrice(symbol, price);
      return price;
    }

    // If NSE failed and we haven't tried BSE, try BSE
    if (exchange !== 'BSE') {
      const bseSymbol = toYahooSymbol(symbol, 'BSE');
      const bseUrl = `${CORS_PROXY}${encodeURIComponent(`${YAHOO_BASE}${encodeURIComponent(bseSymbol)}?interval=1d&range=1d`)}`;

      await waitForRateLimit();
      const bseResp = await fetch(bseUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { 'Accept': 'application/json' },
      });

      if (bseResp.ok) {
        const bseData: unknown = await bseResp.json();
        const bsePrice = validatePriceResponse(bseData, symbol);
        if (bsePrice) {
          cachePrice(symbol, bsePrice);
          return bsePrice;
        }
      }
    }
  } catch {
    // Network error or timeout — fall through to cache
  }

  // Return stale cache if available
  return cached ?? null;
}

export async function fetchBatchPrices(
  holdings: PortfolioHolding[]
): Promise<Map<string, StockPrice>> {
  const priceMap = new Map<string, StockPrice>();
  if (holdings.length === 0) return priceMap;

  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];
    try {
      const price = await fetchStockPrice(h.symbol, h.exchange);
      if (price) {
        priceMap.set(h.symbol, price);
      }
    } catch {
      // Individual fetch failed — continue with others
    }

    // Delay between requests (except last)
    if (i < holdings.length - 1) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return priceMap;
}

/** Get all currently cached prices (valid or stale) */
export function getAllCachedPrices(): Map<string, StockPrice> {
  const cache = loadCache();
  const map = new Map<string, StockPrice>();
  for (const [symbol, entry] of Object.entries(cache)) {
    if (entry && entry.price) {
      map.set(symbol, {
        ...entry.price,
        source: isCacheValid(entry) ? entry.price.source : 'cache',
      });
    }
  }
  return map;
}

/** Clear all cached prices */
export function clearPriceCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
