import { StockTransaction, StockExchange, TradeType, AssetClass, TradeCharges } from '../types';

export type BrokerFormat =
  | 'zerodha' | 'groww' | 'angelone' | 'paytmmoney' | 'geojit'
  | 'sbi_securities' | 'upstox' | 'kotak' | 'icici_direct' | 'hdfc_securities' | 'generic';

export interface TradeParseResult {
  transactions: Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'>[];
  broker: string;
  errors: string[];
  totalBuys: number;
  totalSells: number;
}

// ─── Indian number format parser (handles 1,50,000.00) ──

function parseIndianNumber(value: string): number {
  if (!value || typeof value !== 'string') return 0;
  const cleaned = value.replace(/[₹,\s]/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ─── Normalize symbol ──

function normalizeSymbol(symbol: string): string {
  if (!symbol) return '';
  return symbol
    .replace(/\.(NS|BO|NSE|BSE)$/i, '')
    .replace(/-EQ$/i, '')
    .trim()
    .toUpperCase();
}

// ─── Detect asset class from name/symbol ──

function detectAssetClass(symbol: string, name: string): AssetClass {
  const combined = `${symbol} ${name}`.toLowerCase();
  if (/\b(mutual fund|mf|fund|scheme|growth|dividend|direct|regular|nav)\b/.test(combined)) return 'mutual_fund';
  if (/\b(etf|nifty.*bees|bank.*bees|gold.*bees|liquid.*bees)\b/.test(combined)) return 'etf';
  if (/\b(bond|debenture|ncd|gsec|govt.*sec|sgb|sovereign.*gold)\b/.test(combined)) return 'bond';
  if (/\b(gold|silver|crude|natural.*gas)\b/.test(combined) && !/\b(goldfinance|goldengroup)\b/.test(combined)) return 'gold';
  return 'equity';
}

// ─── Detect exchange ──

function detectExchange(exchange: string): StockExchange {
  if (!exchange) return 'NSE';
  const e = exchange.toUpperCase().trim();
  if (e === 'NSE' || e.includes('NSE')) return 'NSE';
  if (e === 'BSE' || e.includes('BSE')) return 'BSE';
  if (e === 'MCX' || e.includes('MCX')) return 'MCX';
  return 'OTHER';
}

// ─── Parse trade type ──

function parseTradeType(value: string): TradeType {
  if (!value) return 'buy';
  const v = value.toLowerCase().trim();
  if (v === 'buy' || v === 'b') return 'buy';
  if (v === 'sell' || v === 's') return 'sell';
  if (v.includes('dividend') || v === 'div') return 'dividend';
  if (v.includes('bonus')) return 'bonus';
  if (v.includes('split')) return 'split';
  if (v.includes('ipo')) return 'ipo';
  return 'buy';
}

// ─── Parse date to YYYY-MM-DD ──

function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const s = dateStr.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM/DD/YYYY
  const mdyMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try native parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

// ─── Create empty charges ──

function emptyCharges(): TradeCharges {
  return { brokerage: 0, stt: 0, gst: 0, stampDuty: 0, exchangeCharges: 0, sebiCharges: 0, otherCharges: 0, total: 0 };
}

// ─── CSV parsing ──

function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

// ─── Header normalization for matching ──

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findCol(headers: string[], ...candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const c of candidates) {
    const idx = normalized.indexOf(normalizeHeader(c));
    if (idx >= 0) return idx;
  }
  // Partial match
  for (const c of candidates) {
    const cn = normalizeHeader(c);
    const idx = normalized.findIndex(h => h.includes(cn) || cn.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

function getVal(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return '';
  return (row[idx] || '').trim();
}

// ─── Broker detection ──

export function detectBrokerFormat(headers: string[]): BrokerFormat {
  const joined = headers.map(normalizeHeader).join(' ');

  if (joined.includes('isin') && joined.includes('tradeid') && joined.includes('orderid')) return 'zerodha';
  if (joined.includes('companyname') && joined.includes('brokerage') && joined.includes('amount')) return 'groww';
  if (joined.includes('scripname') && joined.includes('stt') && joined.includes('transactioncharges')) return 'angelone';
  if (joined.includes('scrip') && joined.includes('qty') && joined.includes('rate') && !joined.includes('scripcode')) return 'paytmmoney';
  if (joined.includes('settlementno') && joined.includes('netamount')) return 'geojit';
  if (joined.includes('scripcode') && joined.includes('scripname') && joined.includes('buysell')) return 'sbi_securities';
  if (joined.includes('isin') && joined.includes('tradetype') && joined.includes('amount') && !joined.includes('tradeid')) return 'upstox';
  if (joined.includes('orderdate') && joined.includes('series') && joined.includes('value')) return 'kotak';
  if (joined.includes('stocksymbol') && joined.includes('stockname') && joined.includes('tradevalue')) return 'icici_direct';
  if (joined.includes('scriptcode') && joined.includes('scriptname') && joined.includes('value')) return 'hdfc_securities';

  return 'generic';
}

// ─── Broker name display ──

const BROKER_NAMES: Record<BrokerFormat, string> = {
  zerodha: 'Zerodha',
  groww: 'Groww',
  angelone: 'Angel One',
  paytmmoney: 'Paytm Money',
  geojit: 'Geojit',
  sbi_securities: 'SBI Securities',
  upstox: 'Upstox',
  kotak: 'Kotak Securities',
  icici_direct: 'ICICI Direct',
  hdfc_securities: 'HDFC Securities',
  generic: 'Other',
};

// ─── Broker-specific parsers ──

type RowParser = (row: string[], headers: string[]) => Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'> | null;

function zerodhaParser(row: string[], headers: string[]): Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'> | null {
  const iSymbol = findCol(headers, 'symbol');
  const iDate = findCol(headers, 'trade_date', 'tradedate');
  const iExchange = findCol(headers, 'exchange');
  const iType = findCol(headers, 'trade_type', 'tradetype');
  const iQty = findCol(headers, 'quantity');
  const iPrice = findCol(headers, 'price');

  const symbol = normalizeSymbol(getVal(row, iSymbol));
  if (!symbol) return null;

  const qty = parseIndianNumber(getVal(row, iQty));
  const price = parseIndianNumber(getVal(row, iPrice));
  const charges = emptyCharges();

  return {
    date: parseDate(getVal(row, iDate)),
    symbol,
    name: symbol,
    exchange: detectExchange(getVal(row, iExchange)),
    assetClass: detectAssetClass(symbol, symbol),
    type: parseTradeType(getVal(row, iType)),
    quantity: qty,
    price,
    totalValue: Math.round(qty * price * 100) / 100,
    charges,
    broker: 'Zerodha',
    notes: '',
  };
}

function growwParser(row: string[], headers: string[]): Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'> | null {
  const iSymbol = findCol(headers, 'Symbol');
  const iName = findCol(headers, 'Company Name', 'CompanyName');
  const iDate = findCol(headers, 'Date');
  const iExchange = findCol(headers, 'Exchange');
  const iType = findCol(headers, 'Trade Type', 'TradeType');
  const iQty = findCol(headers, 'Quantity');
  const iPrice = findCol(headers, 'Price');
  const iBrokerage = findCol(headers, 'Brokerage');

  const symbol = normalizeSymbol(getVal(row, iSymbol));
  if (!symbol) return null;

  const name = getVal(row, iName) || symbol;
  const qty = parseIndianNumber(getVal(row, iQty));
  const price = parseIndianNumber(getVal(row, iPrice));
  const brokerage = parseIndianNumber(getVal(row, iBrokerage));
  const charges = emptyCharges();
  charges.brokerage = brokerage;
  charges.total = brokerage;

  return {
    date: parseDate(getVal(row, iDate)),
    symbol,
    name,
    exchange: detectExchange(getVal(row, iExchange)),
    assetClass: detectAssetClass(symbol, name),
    type: parseTradeType(getVal(row, iType)),
    quantity: qty,
    price,
    totalValue: Math.round(qty * price * 100) / 100,
    charges,
    broker: 'Groww',
    notes: '',
  };
}

function angeloneParser(row: string[], headers: string[]): Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'> | null {
  const iDate = findCol(headers, 'Trade Date', 'TradeDate');
  const iSymbol = findCol(headers, 'Symbol');
  const iName = findCol(headers, 'Scrip Name', 'ScripName');
  const iType = findCol(headers, 'Buy/Sell', 'BuySell');
  const iQty = findCol(headers, 'Quantity');
  const iPrice = findCol(headers, 'Price');
  const iBrokerage = findCol(headers, 'Brokerage');
  const iStt = findCol(headers, 'STT');
  const iTxnCharges = findCol(headers, 'Transaction Charges', 'TransactionCharges');

  const symbol = normalizeSymbol(getVal(row, iSymbol));
  if (!symbol) return null;

  const name = getVal(row, iName) || symbol;
  const qty = parseIndianNumber(getVal(row, iQty));
  const price = parseIndianNumber(getVal(row, iPrice));
  const brokerage = parseIndianNumber(getVal(row, iBrokerage));
  const stt = parseIndianNumber(getVal(row, iStt));
  const txnCharges = parseIndianNumber(getVal(row, iTxnCharges));
  const charges: TradeCharges = {
    brokerage,
    stt,
    gst: 0,
    stampDuty: 0,
    exchangeCharges: txnCharges,
    sebiCharges: 0,
    otherCharges: 0,
    total: brokerage + stt + txnCharges,
  };

  return {
    date: parseDate(getVal(row, iDate)),
    symbol,
    name,
    exchange: 'NSE',
    assetClass: detectAssetClass(symbol, name),
    type: parseTradeType(getVal(row, iType)),
    quantity: qty,
    price,
    totalValue: Math.round(qty * price * 100) / 100,
    charges,
    broker: 'Angel One',
    notes: '',
  };
}

function paytmmoneyParser(row: string[], headers: string[]): Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'> | null {
  const iDate = findCol(headers, 'Date');
  const iSymbol = findCol(headers, 'Scrip');
  const iExchange = findCol(headers, 'Exchange');
  const iType = findCol(headers, 'Buy/Sell', 'BuySell');
  const iQty = findCol(headers, 'Qty');
  const iRate = findCol(headers, 'Rate');
  const iBrokerage = findCol(headers, 'Brokerage');

  const symbol = normalizeSymbol(getVal(row, iSymbol));
  if (!symbol) return null;

  const qty = parseIndianNumber(getVal(row, iQty));
  const price = parseIndianNumber(getVal(row, iRate));
  const brokerage = parseIndianNumber(getVal(row, iBrokerage));
  const charges = emptyCharges();
  charges.brokerage = brokerage;
  charges.total = brokerage;

  return {
    date: parseDate(getVal(row, iDate)),
    symbol,
    name: symbol,
    exchange: detectExchange(getVal(row, iExchange)),
    assetClass: detectAssetClass(symbol, symbol),
    type: parseTradeType(getVal(row, iType)),
    quantity: qty,
    price,
    totalValue: Math.round(qty * price * 100) / 100,
    charges,
    broker: 'Paytm Money',
    notes: '',
  };
}

function geojitParser(row: string[], headers: string[]): Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'> | null {
  const iDate = findCol(headers, 'Trade Date', 'TradeDate');
  const iSymbol = findCol(headers, 'Symbol');
  const iType = findCol(headers, 'Buy/Sell', 'BuySell');
  const iQty = findCol(headers, 'Quantity');
  const iRate = findCol(headers, 'Rate');
  const iBrokerage = findCol(headers, 'Brokerage');

  const symbol = normalizeSymbol(getVal(row, iSymbol));
  if (!symbol) return null;

  const qty = parseIndianNumber(getVal(row, iQty));
  const price = parseIndianNumber(getVal(row, iRate));
  const brokerage = parseIndianNumber(getVal(row, iBrokerage));
  const charges = emptyCharges();
  charges.brokerage = brokerage;
  charges.total = brokerage;

  return {
    date: parseDate(getVal(row, iDate)),
    symbol,
    name: symbol,
    exchange: 'NSE',
    assetClass: detectAssetClass(symbol, symbol),
    type: parseTradeType(getVal(row, iType)),
    quantity: qty,
    price,
    totalValue: Math.round(qty * price * 100) / 100,
    charges,
    broker: 'Geojit',
    notes: '',
  };
}

function sbiParser(row: string[], headers: string[]): Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'> | null {
  const iDate = findCol(headers, 'Trade Date', 'TradeDate');
  const iSymbol = findCol(headers, 'Scrip Code', 'ScripCode');
  const iName = findCol(headers, 'Scrip Name', 'ScripName');
  const iType = findCol(headers, 'Buy/Sell', 'BuySell');
  const iQty = findCol(headers, 'Quantity');
  const iRate = findCol(headers, 'Rate');

  const symbol = normalizeSymbol(getVal(row, iSymbol));
  if (!symbol) return null;

  const name = getVal(row, iName) || symbol;
  const qty = parseIndianNumber(getVal(row, iQty));
  const price = parseIndianNumber(getVal(row, iRate));

  return {
    date: parseDate(getVal(row, iDate)),
    symbol,
    name,
    exchange: 'BSE',
    assetClass: detectAssetClass(symbol, name),
    type: parseTradeType(getVal(row, iType)),
    quantity: qty,
    price,
    totalValue: Math.round(qty * price * 100) / 100,
    charges: emptyCharges(),
    broker: 'SBI Securities',
    notes: '',
  };
}

function upstoxParser(row: string[], headers: string[]): Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'> | null {
  const iSymbol = findCol(headers, 'Symbol');
  const iDate = findCol(headers, 'Date');
  const iExchange = findCol(headers, 'Exchange');
  const iType = findCol(headers, 'Trade Type', 'TradeType');
  const iQty = findCol(headers, 'Quantity');
  const iPrice = findCol(headers, 'Price');

  const symbol = normalizeSymbol(getVal(row, iSymbol));
  if (!symbol) return null;

  const qty = parseIndianNumber(getVal(row, iQty));
  const price = parseIndianNumber(getVal(row, iPrice));

  return {
    date: parseDate(getVal(row, iDate)),
    symbol,
    name: symbol,
    exchange: detectExchange(getVal(row, iExchange)),
    assetClass: detectAssetClass(symbol, symbol),
    type: parseTradeType(getVal(row, iType)),
    quantity: qty,
    price,
    totalValue: Math.round(qty * price * 100) / 100,
    charges: emptyCharges(),
    broker: 'Upstox',
    notes: '',
  };
}

function kotakParser(row: string[], headers: string[]): Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'> | null {
  const iDate = findCol(headers, 'Order Date', 'OrderDate');
  const iSymbol = findCol(headers, 'Symbol');
  const iType = findCol(headers, 'Buy/Sell', 'BuySell');
  const iQty = findCol(headers, 'Qty');
  const iRate = findCol(headers, 'Rate');
  const iBrokerage = findCol(headers, 'Brokerage');

  const symbol = normalizeSymbol(getVal(row, iSymbol));
  if (!symbol) return null;

  const qty = parseIndianNumber(getVal(row, iQty));
  const price = parseIndianNumber(getVal(row, iRate));
  const brokerage = parseIndianNumber(getVal(row, iBrokerage));
  const charges = emptyCharges();
  charges.brokerage = brokerage;
  charges.total = brokerage;

  return {
    date: parseDate(getVal(row, iDate)),
    symbol,
    name: symbol,
    exchange: 'NSE',
    assetClass: detectAssetClass(symbol, symbol),
    type: parseTradeType(getVal(row, iType)),
    quantity: qty,
    price,
    totalValue: Math.round(qty * price * 100) / 100,
    charges,
    broker: 'Kotak Securities',
    notes: '',
  };
}

function iciciParser(row: string[], headers: string[]): Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'> | null {
  const iDate = findCol(headers, 'Trade Date', 'TradeDate');
  const iSymbol = findCol(headers, 'Stock Symbol', 'StockSymbol');
  const iName = findCol(headers, 'Stock Name', 'StockName');
  const iType = findCol(headers, 'Buy/Sell', 'BuySell');
  const iQty = findCol(headers, 'Qty');
  const iRate = findCol(headers, 'Rate');
  const iBrokerage = findCol(headers, 'Brokerage');

  const symbol = normalizeSymbol(getVal(row, iSymbol));
  if (!symbol) return null;

  const name = getVal(row, iName) || symbol;
  const qty = parseIndianNumber(getVal(row, iQty));
  const price = parseIndianNumber(getVal(row, iRate));
  const brokerage = parseIndianNumber(getVal(row, iBrokerage));
  const charges = emptyCharges();
  charges.brokerage = brokerage;
  charges.total = brokerage;

  return {
    date: parseDate(getVal(row, iDate)),
    symbol,
    name,
    exchange: 'NSE',
    assetClass: detectAssetClass(symbol, name),
    type: parseTradeType(getVal(row, iType)),
    quantity: qty,
    price,
    totalValue: Math.round(qty * price * 100) / 100,
    charges,
    broker: 'ICICI Direct',
    notes: '',
  };
}

function hdfcParser(row: string[], headers: string[]): Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'> | null {
  const iDate = findCol(headers, 'Trade Date', 'TradeDate');
  const iSymbol = findCol(headers, 'Script Code', 'ScriptCode');
  const iName = findCol(headers, 'Script Name', 'ScriptName');
  const iType = findCol(headers, 'Buy/Sell', 'BuySell');
  const iQty = findCol(headers, 'Quantity');
  const iRate = findCol(headers, 'Rate');

  const symbol = normalizeSymbol(getVal(row, iSymbol));
  if (!symbol) return null;

  const name = getVal(row, iName) || symbol;
  const qty = parseIndianNumber(getVal(row, iQty));
  const price = parseIndianNumber(getVal(row, iRate));

  return {
    date: parseDate(getVal(row, iDate)),
    symbol,
    name,
    exchange: 'NSE',
    assetClass: detectAssetClass(symbol, name),
    type: parseTradeType(getVal(row, iType)),
    quantity: qty,
    price,
    totalValue: Math.round(qty * price * 100) / 100,
    charges: emptyCharges(),
    broker: 'HDFC Securities',
    notes: '',
  };
}

function genericParser(row: string[], headers: string[]): Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'> | null {
  const iDate = findCol(headers, 'Date', 'Trade Date', 'TradeDate', 'Order Date');
  const iSymbol = findCol(headers, 'Symbol', 'Scrip', 'Scrip Code', 'Stock Symbol', 'Script Code');
  const iName = findCol(headers, 'Name', 'Company Name', 'Scrip Name', 'Stock Name', 'Script Name');
  const iType = findCol(headers, 'Buy/Sell', 'Trade Type', 'Type', 'BuySell', 'TradeType');
  const iQty = findCol(headers, 'Quantity', 'Qty');
  const iPrice = findCol(headers, 'Price', 'Rate');
  const iExchange = findCol(headers, 'Exchange');
  const iBrokerage = findCol(headers, 'Brokerage');

  const symbol = normalizeSymbol(getVal(row, iSymbol));
  if (!symbol) return null;

  const name = getVal(row, iName) || symbol;
  const qty = parseIndianNumber(getVal(row, iQty));
  const price = parseIndianNumber(getVal(row, iPrice));
  const brokerage = parseIndianNumber(getVal(row, iBrokerage));
  const charges = emptyCharges();
  charges.brokerage = brokerage;
  charges.total = brokerage;

  return {
    date: parseDate(getVal(row, iDate)),
    symbol,
    name,
    exchange: detectExchange(getVal(row, iExchange)),
    assetClass: detectAssetClass(symbol, name),
    type: parseTradeType(getVal(row, iType)),
    quantity: qty,
    price,
    totalValue: Math.round(qty * price * 100) / 100,
    charges,
    broker: 'Other',
    notes: '',
  };
}

const PARSERS: Record<BrokerFormat, RowParser> = {
  zerodha: zerodhaParser,
  groww: growwParser,
  angelone: angeloneParser,
  paytmmoney: paytmmoneyParser,
  geojit: geojitParser,
  sbi_securities: sbiParser,
  upstox: upstoxParser,
  kotak: kotakParser,
  icici_direct: iciciParser,
  hdfc_securities: hdfcParser,
  generic: genericParser,
};

// ─── Main parse function ──

export function parseTradeData(csvContent: string, brokerHint?: BrokerFormat): TradeParseResult {
  const rows = parseCSV(csvContent);
  if (rows.length < 2) {
    return { transactions: [], broker: 'Unknown', errors: ['File appears to be empty or has no data rows'], totalBuys: 0, totalSells: 0 };
  }

  const headers = rows[0];
  const format = brokerHint && brokerHint !== 'generic' ? brokerHint : detectBrokerFormat(headers);
  const parser = PARSERS[format];
  const broker = BROKER_NAMES[format];

  const transactions: Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const errors: string[] = [];
  let totalBuys = 0;
  let totalSells = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= 1 && !row[0]) continue; // skip empty rows

    try {
      const txn = parser(row, headers);
      if (txn && txn.symbol && txn.quantity > 0) {
        transactions.push(txn);
        if (txn.type === 'buy' || txn.type === 'ipo') totalBuys++;
        if (txn.type === 'sell') totalSells++;
      }
    } catch (err) {
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Parse error'}`);
    }
  }

  if (transactions.length === 0 && errors.length === 0) {
    errors.push('No valid transactions found. Please check the file format.');
  }

  return { transactions, broker, errors, totalBuys, totalSells };
}
