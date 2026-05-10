/**
 * Symbol Aliases — maps broker/company-name symbols to NSE ticker symbols.
 *
 * When brokers (especially Geojit DP Holdings) export data, they use company names
 * with spaces removed (e.g., "HBLPOWERSYSTEMS") instead of NSE tickers ("HBLPOWER").
 * This map normalizes those to the correct NSE trading symbol that Yahoo Finance recognizes.
 *
 * Usage:
 *   - In stockPriceService.ts: resolve alias before looking up in prices.json
 *   - In fetch-prices.mjs: resolve alias before fetching from Yahoo Finance
 *
 * To add new mappings: add the broker symbol (uppercase, no spaces) as key,
 * and the NSE ticker symbol as value.
 */

// Broker/company-name symbol → NSE ticker symbol
export const SYMBOL_ALIASES: Record<string, string> = {
  // Geojit DP Holdings format (company name with spaces removed)
  'HBLPOWERSYSTEMS': 'HBLPOWER',
  'UJJIVANSMALLFINANCEB': 'UJJIVANSFB',
  'NATIONALALUMINIUMCOM': 'NATIONALUM',
  'THEFEDERALBANK': 'FEDERALBNK',
  'BHARATELECTRONICS': 'BEL',
  'BHARATFORGE': 'BHARATFORG',
  'VEDANTA': 'VEDL',
  'IDFCFITBANK': 'IDFCFIRSTB',
  'JKTY&INDUSTRIES': 'JKTYRE',
  'UNITECH': 'UNITECH', // same on NSE

  // Common variations
  'RELIANCEINDUSTRIES': 'RELIANCE',
  'TATACONSULTANCYSER': 'TCS',
  'INFOSYS': 'INFY',
  'HABORENEWABLE': 'HBLPOWER',
  'STATEBANKOFINDIA': 'SBIN',
  'HINDUSTANUNILEVER': 'HINDUNILVR',
  'LARSEN&TOUBRO': 'LT',
  'MAHINDRA&MAHINDRA': 'M&M',
  'ICICIBANK': 'ICICIBANK',
  'HDFCBANK': 'HDFCBANK',
  'KOTAKMAHINDRABANK': 'KOTAKBANK',
  'AXISBANK': 'AXISBANK',
  'BAJAJFINANCE': 'BAJFINANCE',
  'BAJAJFINSERV': 'BAJFINSERV',
  'ADANIENTERPRISE': 'ADANIENT',
  'ADANIENTERPRISESLI': 'ADANIENT',
  'ADANIPORTSANDSPECI': 'ADANIPORTS',
  'ADANIGREENENERGYLT': 'ADANIGREEN',
  'ASIANPAINTS': 'ASIANPAINT',
  'BHARTIAIRTEL': 'BHARTIARTL',
  'MARUTISUZUKIINDIA': 'MARUTI',
  'SUNPHARMACEUTICALIN': 'SUNPHARMA',
  'TATASTEELLTD': 'TATASTEEL',
  'TATASTEEL': 'TATASTEEL',
  'JSWSTEEL': 'JSWSTEEL',
  'ULTRATECHCEMENT': 'ULTRACEMCO',
  'NESTLEINDIA': 'NESTLEIND',
  'POWERGRIDCORPORATI': 'POWERGRID',
  'CIPLA': 'CIPLA',
  'DRREDDY': 'DRREDDY',
  'DRREDDYSLABORATORIE': 'DRREDDY',
  'DIVISLAB': 'DIVISLAB',
  'DIVISLABORATORIES': 'DIVISLAB',
  'COALINDIA': 'COALINDIA',
  'HEROMOTOCORP': 'HEROMOTOCO',
  'EICHERMOTORS': 'EICHERMOT',
  'BRITANNIAINDUSTRIES': 'BRITANNIA',
  'APOLLOHOSPITALSENT': 'APOLLOHOSP',
  'INDUSINDBK': 'INDUSINDBK',
  'INDUSTOWERLTD': 'INDUSTOWER',
  'SHRIRAMFINANCE': 'SHRIRAMFIN',
  'TRENT': 'TRENT',
  'TITAN': 'TITAN',
  'TITANCOMPANY': 'TITAN',
  'GRASIM': 'GRASIM',
  'GRASIMINDUSTRIES': 'GRASIM',
  'TECHM': 'TECHM',
  'TECHMAHINDRA': 'TECHM',
  'HCLTECH': 'HCLTECH',
  'HCLTECHNOLOGIES': 'HCLTECH',
  'ITC': 'ITC',
  'NTPC': 'NTPC',
  'ONGC': 'ONGC',
  'BPCL': 'BPCL',
  'WIPRO': 'WIPRO',

  // Tata Motors demerger
  'TATAMOTORS': 'TMPV',
  'TATAMOTORSPASSENGE': 'TMPV',
  'TATAMOTORSCOMMERCI': 'TMCV',

  // Zomato rebranded
  'ZOMATO': 'ETERNAL',
  'ZOMATOLTD': 'ETERNAL',

  // Additional common stocks
  'AVENUEECOMMERCE': 'DMART',
  'DMARTAVENUE': 'DMART',
  'BAJAJ-AUTO': 'BAJAJ-AUTO',
  'BAJAJAUTO': 'BAJAJ-AUTO',
  'IRCTC': 'IRCTC',
  'HAVELLSINDIA': 'HAVELLS',
  'HAVELLS': 'HAVELLS',
  'PIDILITEINDUSTRIES': 'PIDILITIND',
  'PAGEINDUST': 'PAGEIND',
  'PAGEINDUSTRIES': 'PAGEIND',
  'AMBUJACEMENTS': 'AMBUJACEM',
  'ACCCEMENT': 'ACC',
  'SBICARD': 'SBICARD',
  'SBILIFEINSURANC': 'SBILIFE',
  'HABORPOWER': 'HBLPOWER',
  'POWERFINANCECORPOR': 'PFC',
  'RECLTD': 'RECLTD',
  'IREDA': 'IREDA',
  'NHPC': 'NHPC',
  'BANKOFINDIA': 'BANKINDIA',
  'CANARABANK': 'CANBK',
  'PUNJABNATIONALBANK': 'PNB',
  'BANKOFBARODA': 'BANKBARODA',
  'INDIANBANK': 'INDIANB',
  'TATAPOWER': 'TATAPOWER',
  'TATAELXSI': 'TATAELXSI',
  'TATACHEMICALS': 'TATACHEM',
  'TATACOMMUNICATIONS': 'TATACOMM',
  'LTIMINDTREE': 'LTIM',
  'MANAPPURAM': 'MANAPPURAM',
  'MUTHOOTFINANCE': 'MUTHOOTFIN',
  'SUZLOENERGY': 'SUZLON',
  'ADANIPOWER': 'ADANIPOWER',
  'ADANITOTALGAS': 'ATGL',
  'HINDALCOINDUSTRIES': 'HINDALCO',
  'HINDALCO': 'HINDALCO',
  'JINDALSTELPOWER': 'JINDALSTEL',
  'KOLTEPATILDEVELOPER': 'KOLTEPATIL',
  'GODREJPROPERTIES': 'GODREJPROP',
  'DLFLTD': 'DLF',
  'OBEROIREALTY': 'OBEROIRLTY',
  'PRESTIGE': 'PRESTIGE',
  'CENTURYTEXTILES&IN': 'CENTURYTEX',
  'BHEL': 'BHEL',
};

/**
 * Resolve a portfolio symbol to its NSE ticker.
 * Returns the original symbol if no alias is found.
 */
export function resolveSymbol(symbol: string): string {
  return SYMBOL_ALIASES[symbol] || symbol;
}

/**
 * Resolve a portfolio symbol to its NSE ticker for price lookup.
 * Tries exact match first, then uppercase match.
 */
export function resolveSymbolForPriceLookup(symbol: string): string {
  const upper = symbol.toUpperCase();
  return SYMBOL_ALIASES[upper] || upper;
}
