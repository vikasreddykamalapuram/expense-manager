/**
 * Stock Price Service — reads prices from static prices.json (same-origin).
 *
 * Architecture:
 *   GitHub Action (every 15 min during market hours)
 *     → fetches Yahoo Finance server-side (no CORS issues)
 *     → writes public/prices.json
 *     → commits to repo → GitHub Pages serves it
 *
 *   This service reads prices.json from same origin — zero CORS problems.
 *   Falls back to localStorage cache when prices.json is unavailable.
 */

import { PortfolioHolding } from '../types';
import { resolveSymbolForPriceLookup } from './symbolAliases';

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
  source: 'live' | 'cache';
}

interface PricesJson {
  data: Record<string, {
    symbol: string;
    price: number;
    previousClose: number;
    open: number;
    dayHigh: number;
    dayLow: number;
    change: number;
    changePercent: number;
  }>;
  fetchedAt: string;
  marketStatus: 'open' | 'closed';
  stats: { total: number; success: number; failed: number };
}

interface PriceCache {
  price: StockPrice;
  cachedAt: number;
}

// ─── Constants ──────────────────────────────────────────

const CACHE_KEY = 'em_stock_prices';
const PRICES_JSON_URL = `${import.meta.env.BASE_URL}prices.json`;
const MARKET_CACHE_TTL = 15 * 60 * 1000; // 15 min
const OFF_MARKET_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache for prices.json (avoid re-fetching within same session)
let pricesJsonCache: PricesJson | null = null;
let pricesJsonFetchedAt = 0;

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
    // localStorage full or unavailable
  }
}

function isIndianMarketOpen(): boolean {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const ist = new Date(utcMs + 5.5 * 60 * 60_000);
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
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
  return { ...entry.price, source: 'cache' };
}

function cachePrice(symbol: string, price: StockPrice): void {
  const cache = loadCache();
  cache[symbol] = { price, cachedAt: Date.now() };
  saveCache(cache);
}

// ─── Prices.json Fetcher ────────────────────────────────

async function fetchPricesJson(): Promise<PricesJson | null> {
  // Use in-memory cache if fresh (re-fetch at most every 5 min)
  if (pricesJsonCache && Date.now() - pricesJsonFetchedAt < 5 * 60 * 1000) {
    return pricesJsonCache;
  }

  try {
    const resp = await fetch(PRICES_JSON_URL, {
      signal: AbortSignal.timeout(10_000),
      cache: 'no-cache', // bypass browser cache to get latest
    });

    if (!resp.ok) return null;

    const data: PricesJson = await resp.json();
    if (!data?.data || typeof data.data !== 'object') return null;

    pricesJsonCache = data;
    pricesJsonFetchedAt = Date.now();
    return data;
  } catch {
    return null;
  }
}

function parsePriceEntry(
  symbol: string,
  entry: PricesJson['data'][string],
  fetchedAt: string
): StockPrice {
  return {
    symbol,
    currentPrice: entry.price,
    previousClose: entry.previousClose,
    change: entry.change,
    changePercent: entry.changePercent,
    dayHigh: entry.dayHigh,
    dayLow: entry.dayLow,
    lastUpdated: fetchedAt,
    source: 'live',
  };
}

// ─── Public API ─────────────────────────────────────────

export async function fetchStockPrice(symbol: string): Promise<StockPrice | null> {
  const resolved = resolveSymbolForPriceLookup(symbol);

  // Try prices.json first (using resolved NSE ticker)
  const pricesJson = await fetchPricesJson();
  if (pricesJson?.data[resolved]) {
    const price = parsePriceEntry(symbol, pricesJson.data[resolved], pricesJson.fetchedAt);
    cachePrice(symbol, price);
    return price;
  }

  // Also try original symbol in case it matches directly
  if (resolved !== symbol && pricesJson?.data[symbol]) {
    const price = parsePriceEntry(symbol, pricesJson.data[symbol], pricesJson.fetchedAt);
    cachePrice(symbol, price);
    return price;
  }

  // Fallback to localStorage cache
  return getCachedPrice(symbol);
}

export async function fetchBatchPrices(
  holdings: PortfolioHolding[]
): Promise<Map<string, StockPrice>> {
  const priceMap = new Map<string, StockPrice>();
  if (holdings.length === 0) return priceMap;

  // Single fetch to get all prices from prices.json
  const pricesJson = await fetchPricesJson();

  for (const h of holdings) {
    const resolved = resolveSymbolForPriceLookup(h.symbol);

    // Try resolved alias first, then original symbol
    const entry = pricesJson?.data[resolved] || pricesJson?.data[h.symbol];

    if (entry) {
      const price = parsePriceEntry(h.symbol, entry, pricesJson!.fetchedAt);
      priceMap.set(h.symbol, price);
      cachePrice(h.symbol, price);
    } else {
      // Fallback to cached price
      const cached = getCachedPrice(h.symbol);
      if (cached) priceMap.set(h.symbol, cached);
    }
  }

  return priceMap;
}

/** Get all currently cached prices (valid or stale) */
export function getAllCachedPrices(): Map<string, StockPrice> {
  const cache = loadCache();
  const map = new Map<string, StockPrice>();
  for (const [symbol, entry] of Object.entries(cache)) {
    if (entry?.price) {
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

/** Get prices.json metadata (for displaying freshness in UI) */
export async function getPricesFreshness(): Promise<{
  fetchedAt: string;
  marketStatus: string;
  symbolCount: number;
} | null> {
  const pricesJson = await fetchPricesJson();
  if (!pricesJson) return null;
  return {
    fetchedAt: pricesJson.fetchedAt,
    marketStatus: pricesJson.marketStatus,
    symbolCount: pricesJson.stats.success,
  };
}

/**
 * Update the stock-symbols.json manifest so GitHub Actions knows
 * which symbols to fetch. Called when user imports new trades.
 */
export function getSymbolsForManifest(holdings: PortfolioHolding[]): string[] {
  return [...new Set(holdings.map(h => h.symbol))].sort();
}

/** Check if prices.json exists and has data */
export async function hasPricesData(): Promise<boolean> {
  const pricesJson = await fetchPricesJson();
  return pricesJson !== null && Object.keys(pricesJson.data).length > 0;
}

/** Get the set of symbols currently tracked in prices.json */
export async function getTrackedSymbols(): Promise<Set<string>> {
  const pricesJson = await fetchPricesJson();
  if (!pricesJson?.data) return new Set();
  return new Set(Object.keys(pricesJson.data));
}

/** Find symbols from holdings that are NOT in prices.json (checking aliases too) */
export async function getUntrackedSymbols(holdingSymbols: string[]): Promise<string[]> {
  const tracked = await getTrackedSymbols();
  return holdingSymbols.filter(s => {
    const resolved = resolveSymbolForPriceLookup(s);
    return !tracked.has(s) && !tracked.has(resolved);
  });
}

/** Build the GitHub workflow dispatch URL for adding new symbols */
export function getWorkflowDispatchUrl(repoUrl: string, symbols: string[]): string {
  // Strip .git suffix and build Actions URL
  const base = repoUrl.replace(/\.git$/, '');
  const symbolsStr = encodeURIComponent(symbols.join(','));
  return `${base}/actions/workflows/update-prices.yml?query=workflow_dispatch&symbols=${symbolsStr}`;
}
