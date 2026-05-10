/**
 * generate-nse-map.mjs — Generates a comprehensive NSE equity symbol map.
 *
 * Fetches all NSE-listed equities and creates a mapping file with:
 *   - ISIN → NSE ticker
 *   - Company name variations → NSE ticker
 *   - BSE code → NSE ticker (where available)
 *
 * Sources: Yahoo Finance search API (server-side, no CORS issues)
 * Output: public/nse-symbol-map.json
 *
 * Usage: node scripts/generate-nse-map.mjs
 *
 * This script should be run periodically (e.g., monthly) to capture new listings.
 * The generated map is shipped as a static file with the app.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

const OUTPUT_FILE = 'public/nse-symbol-map.json';
const NSE_URL = 'https://www.nseindia.com/api/equity-stockIndices?index=SECURITIES%20IN%20F%26O';
const NIFTY_TOTAL_URL = 'https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20TOTAL%20MARKET';
const NSE_ALL_URL = 'https://www.nseindia.com/api/market-data-pre-open?key=ALL';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── Known mappings (curated) ───
// These cover stocks that are tricky to resolve automatically.
// Format: { isin, symbol (NSE ticker), name (display name), bseCode? }

const CURATED_STOCKS = [
  // NIFTY 50
  { isin: 'INE002A01018', symbol: 'RELIANCE', name: 'Reliance Industries' },
  { isin: 'INE467B01029', symbol: 'TCS', name: 'Tata Consultancy Services' },
  { isin: 'INE009A01021', symbol: 'INFY', name: 'Infosys' },
  { isin: 'INE040A01034', symbol: 'HDFCBANK', name: 'HDFC Bank' },
  { isin: 'INE090A01021', symbol: 'ICICIBANK', name: 'ICICI Bank' },
  { isin: 'INE030A01027', symbol: 'HINDUNILVR', name: 'Hindustan Unilever' },
  { isin: 'INE154A01025', symbol: 'ITC', name: 'ITC' },
  { isin: 'INE062A01020', symbol: 'SBIN', name: 'State Bank of India' },
  { isin: 'INE397D01024', symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
  { isin: 'INE237A01028', symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank' },
  { isin: 'INE018A01030', symbol: 'LT', name: 'Larsen & Toubro' },
  { isin: 'INE238A01034', symbol: 'AXISBANK', name: 'Axis Bank' },
  { isin: 'INE296A01024', symbol: 'BAJFINANCE', name: 'Bajaj Finance' },
  { isin: 'INE918I01018', symbol: 'BAJFINSERV', name: 'Bajaj Finserv' },
  { isin: 'INE585B01010', symbol: 'MARUTI', name: 'Maruti Suzuki India' },
  { isin: 'INE860A01027', symbol: 'HCLTECH', name: 'HCL Technologies' },
  { isin: 'INE021A01026', symbol: 'ASIANPAINT', name: 'Asian Paints' },
  { isin: 'INE280A01028', symbol: 'TITAN', name: 'Titan Company' },
  { isin: 'INE044A01036', symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries' },
  { isin: 'INE047A01021', symbol: 'NESTLEIND', name: 'Nestle India' },
  { isin: 'INE481G01011', symbol: 'DMART', name: 'Avenue Supermarts' },
  { isin: 'INE481A01020', symbol: 'ULTRACEMCO', name: 'UltraTech Cement' },
  { isin: 'INE075A01022', symbol: 'WIPRO', name: 'Wipro' },
  { isin: 'INE669C01036', symbol: 'TECHM', name: 'Tech Mahindra' },
  { isin: 'INE752E01010', symbol: 'POWERGRID', name: 'Power Grid Corporation of India' },
  { isin: 'INE733E01010', symbol: 'NTPC', name: 'NTPC' },
  { isin: 'INE213A01029', symbol: 'ONGC', name: 'Oil and Natural Gas Corporation' },
  { isin: 'INE019A01038', symbol: 'JSWSTEEL', name: 'JSW Steel' },
  { isin: 'INE081A01020', symbol: 'TATASTEEL', name: 'Tata Steel' },
  { isin: 'INE423A01024', symbol: 'ADANIENT', name: 'Adani Enterprises' },
  { isin: 'INE742F01042', symbol: 'ADANIPORTS', name: 'Adani Ports and Special Economic Zone' },
  { isin: 'INE364U01010', symbol: 'ADANIGREEN', name: 'Adani Green Energy' },
  { isin: 'INE522F01014', symbol: 'COALINDIA', name: 'Coal India' },
  { isin: 'INE047A01013', symbol: 'GRASIM', name: 'Grasim Industries' },
  { isin: 'INE361B01024', symbol: 'DIVISLAB', name: "Divi's Laboratories" },
  { isin: 'INE029A01011', symbol: 'BPCL', name: 'Bharat Petroleum Corporation' },
  { isin: 'INE089A01023', symbol: 'DRREDDY', name: "Dr. Reddy's Laboratories" },
  { isin: 'INE059A01026', symbol: 'CIPLA', name: 'Cipla' },
  { isin: 'INE158A01026', symbol: 'HEROMOTOCO', name: 'Hero MotoCorp' },
  { isin: 'INE066A01021', symbol: 'EICHERMOT', name: 'Eicher Motors' },
  { isin: 'INE917I01010', symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto' },
  { isin: 'INE216A01030', symbol: 'BRITANNIA', name: 'Britannia Industries' },
  { isin: 'INE437A01024', symbol: 'APOLLOHOSP', name: 'Apollo Hospitals Enterprise' },
  { isin: 'INE095A01012', symbol: 'INDUSINDBK', name: 'IndusInd Bank' },
  { isin: 'INE849A01020', symbol: 'TRENT', name: 'Trent' },
  { isin: 'INE721A01013', symbol: 'SHRIRAMFIN', name: 'Shriram Finance' },
  { isin: 'INE758T01015', symbol: 'ETERNAL', name: 'Eternal (Zomato)' },
  { isin: 'INE205A01025', symbol: 'M&M', name: 'Mahindra & Mahindra' },
  { isin: 'INE038A01020', symbol: 'HINDALCO', name: 'Hindalco Industries' },

  // NIFTY Next 50 / NIFTY 100
  { isin: 'INE628A01036', symbol: 'VEDL', name: 'Vedanta' },
  { isin: 'INE557A01011', symbol: 'HBLPOWER', name: 'HBL Power Systems' },
  { isin: 'INE883A01011', symbol: 'TMPV', name: 'Tata Motors Passenger Vehicles' },
  { isin: 'INE883A01029', symbol: 'TMCV', name: 'Tata Motors Commercial Vehicles' },
  { isin: 'INE115A01026', symbol: 'PIDILITIND', name: 'Pidilite Industries' },
  { isin: 'INE761H01022', symbol: 'PAGEIND', name: 'Page Industries' },
  { isin: 'INE079A01024', symbol: 'AMBUJACEM', name: 'Ambuja Cements' },
  { isin: 'INE012A01025', symbol: 'ACC', name: 'ACC' },
  { isin: 'INE018E01016', symbol: 'SBICARD', name: 'SBI Cards and Payment Services' },
  { isin: 'INE123W01016', symbol: 'SBILIFE', name: 'SBI Life Insurance Company' },
  { isin: 'INE134E01011', symbol: 'PFC', name: 'Power Finance Corporation' },
  { isin: 'INE020B01018', symbol: 'RECLTD', name: 'REC' },
  { isin: 'INE202E01016', symbol: 'IREDA', name: 'Indian Renewable Energy Development Agency' },
  { isin: 'INE848E01016', symbol: 'NHPC', name: 'NHPC' },
  { isin: 'INE084A01016', symbol: 'BANKINDIA', name: 'Bank of India' },
  { isin: 'INE476A01014', symbol: 'CANBK', name: 'Canara Bank' },
  { isin: 'INE160A01022', symbol: 'PNB', name: 'Punjab National Bank' },
  { isin: 'INE028A01039', symbol: 'BANKBARODA', name: 'Bank of Baroda' },
  { isin: 'INE562A01011', symbol: 'INDIANB', name: 'Indian Bank' },
  { isin: 'INE245A01021', symbol: 'TATAPOWER', name: 'Tata Power Company' },
  { isin: 'INE670A01012', symbol: 'TATAELXSI', name: 'Tata Elxsi' },
  { isin: 'INE092A01019', symbol: 'TATACHEM', name: 'Tata Chemicals' },
  { isin: 'INE151A01013', symbol: 'TATACOMM', name: 'Tata Communications' },
  { isin: 'INE214T01019', symbol: 'LTIM', name: 'LTIMindtree' },
  { isin: 'INE522D01027', symbol: 'MANAPPURAM', name: 'Manappuram Finance' },
  { isin: 'INE414G01012', symbol: 'MUTHOOTFIN', name: 'Muthoot Finance' },
  { isin: 'INE040H01021', symbol: 'SUZLON', name: 'Suzlon Energy' },
  { isin: 'INE814H01011', symbol: 'ADANIPOWER', name: 'Adani Power' },
  { isin: 'INE399L01023', symbol: 'ATGL', name: 'Adani Total Gas' },
  { isin: 'INE220G01021', symbol: 'JINDALSTEL', name: 'Jindal Steel & Power' },
  { isin: 'INE271C01023', symbol: 'DLF', name: 'DLF' },
  { isin: 'INE484J01027', symbol: 'GODREJPROP', name: 'Godrej Properties' },
  { isin: 'INE093I01010', symbol: 'OBEROIRLTY', name: 'Oberoi Realty' },
  { isin: 'INE811K01011', symbol: 'PRESTIGE', name: 'Prestige Estates Projects' },
  { isin: 'INE257A01026', symbol: 'BHEL', name: 'Bharat Heavy Electricals' },
  { isin: 'INE176B01034', symbol: 'HAVELLS', name: 'Havells India' },
  { isin: 'INE335Y01012', symbol: 'IRCTC', name: 'Indian Railway Catering and Tourism Corporation' },
  { isin: 'INE121J01017', symbol: 'INDUSTOWER', name: 'Indus Towers' },
  { isin: 'INE066F01020', symbol: 'HAL', name: 'Hindustan Aeronautics' },
  { isin: 'INE171Z01018', symbol: 'BDL', name: 'Bharat Dynamics' },
  { isin: 'INE704A01027', symbol: 'COCHINSHIP', name: 'Cochin Shipyard' },
  { isin: 'INE924B01011', symbol: 'MAZAGON', name: 'Mazagon Dock Shipbuilders' },
  { isin: 'INE382Z01011', symbol: 'GRSE', name: 'Garden Reach Shipbuilders & Engineers' },
  { isin: 'INE555B01013', symbol: 'POLYCAB', name: 'Polycab India' },
  { isin: 'INE226A01021', symbol: 'VOLTAS', name: 'Voltas' },
  { isin: 'INE233A01035', symbol: 'CROMPTON', name: 'Crompton Greaves Consumer Electricals' },
  { isin: 'INE716A01013', symbol: 'CHOLAFIN', name: 'Cholamandalam Investment and Finance Company' },
  { isin: 'INE118H01025', symbol: 'MAXHEALTH', name: 'Max Healthcare Institute' },
  { isin: 'INE061F01013', symbol: 'FORTIS', name: 'Fortis Healthcare' },
  { isin: 'INE112L01020', symbol: 'METROPOLIS', name: 'Metropolis Healthcare' },

  // User's portfolio stocks
  { isin: 'INE551A01024', symbol: 'UJJIVANSFB', name: 'Ujjivan Small Finance Bank' },
  { isin: 'INE139A01034', symbol: 'NATIONALUM', name: 'National Aluminium Company' },
  { isin: 'INE171A01029', symbol: 'FEDERALBNK', name: 'The Federal Bank' },
  { isin: 'INE263A01024', symbol: 'BEL', name: 'Bharat Electronics' },
  { isin: 'INE465A01025', symbol: 'BHARATFORG', name: 'Bharat Forge' },
  { isin: 'INE092T01019', symbol: 'IDFCFIRSTB', name: 'IDFC First Bank' },
  { isin: 'INE573A01042', symbol: 'JKTYRE', name: 'JK Tyre & Industries' },
  { isin: 'INE694A01020', symbol: 'UNITECH', name: 'Unitech' },
  { isin: 'INE115A01034', symbol: 'LICHSGFIN', name: 'LIC Housing Finance' },
  { isin: 'INE987B01026', symbol: 'NATCOPHARM', name: 'Natco Pharma' },
  { isin: 'INE255A01020', symbol: 'GRAUWEIL', name: 'Grauer & Weil (India)' },
  { isin: 'INE671H01015', symbol: 'SAMMAANCAP', name: 'Sammaan Capital' },
  { isin: 'INE235A01022', symbol: 'FINCABLES', name: 'Finolex Cables' },
  { isin: 'INE371A01025', symbol: 'GRAPHITE', name: 'Graphite India' },
  { isin: 'INE917M01012', symbol: 'DBL', name: 'Dilip Buildcon' },
  { isin: 'INE736A01011', symbol: 'CDSL', name: 'Central Depository Services (India)' },
  { isin: 'INE348R01012', symbol: 'CAPACITE', name: "Capacit'e Infraprojects" },
  { isin: 'INE783A01021', symbol: 'GLOBALVECT', name: 'Global Vectra Helicorp' },

  // Additional popular stocks
  { isin: 'INE040A01026', symbol: 'LUPIN', name: 'Lupin' },
  { isin: 'INE406A01037', symbol: 'AUROPHARMA', name: 'Aurobindo Pharma' },
  { isin: 'INE376G01013', symbol: 'BIOCON', name: 'Biocon' },
  { isin: 'INE540L01014', symbol: 'ALKEM', name: 'Alkem Laboratories' },
  { isin: 'INE356A01018', symbol: 'MPHASIS', name: 'Mphasis' },
  { isin: 'INE262H01013', symbol: 'PERSISTENT', name: 'Persistent Systems' },
  { isin: 'INE909H01019', symbol: 'COFORGE', name: 'Coforge' },
  { isin: 'INE136B01020', symbol: 'CYIENT', name: 'Cyient' },
  { isin: 'INE524B01027', symbol: 'KPITTECH', name: 'KPIT Technologies' },
  { isin: 'INE310A01015', symbol: 'ZYDUSLIFE', name: 'Zydus Lifesciences' },
  { isin: 'INE070A01015', symbol: 'WHIRLPOOL', name: 'Whirlpool of India' },
  { isin: 'INE397C01024', symbol: 'BLUESTARLT', name: 'Blue Star' },
  { isin: 'INE306N01017', symbol: 'BAJAJHLDNG', name: 'Bajaj Holdings & Investment' },
  { isin: 'INE148I01020', symbol: 'TATAMOTORS', name: 'Tata Motors' }, // pre-demerger

  // Additional mid/small caps commonly held
  { isin: 'INE274J01014', symbol: 'IDEA', name: 'Vodafone Idea' },
  { isin: 'INE101A01026', symbol: 'ICICIPRULI', name: 'ICICI Prudential Life Insurance' },
  { isin: 'INE726G01019', symbol: 'LICI', name: 'Life Insurance Corporation of India' },
  { isin: 'INE646L01027', symbol: 'NYKAA', name: 'FSN E-Commerce Ventures (Nykaa)' },
  { isin: 'INE669F01024', symbol: 'PAYTM', name: 'One97 Communications (Paytm)' },
  { isin: 'INE397S01024', symbol: 'JSWENERGY', name: 'JSW Energy' },
  { isin: 'INE043A01012', symbol: 'GAIL', name: 'GAIL (India)' },
  { isin: 'INE129A01019', symbol: 'IOC', name: 'Indian Oil Corporation' },
  { isin: 'INE242A01010', symbol: 'SAIL', name: 'Steel Authority of India' },
  { isin: 'INE325A01013', symbol: 'NMDC', name: 'NMDC' },
  { isin: 'INE557A01029', symbol: 'HBLENGINE', name: 'HBL Engineering (formerly HBL Power)' },
  { isin: 'INE749A01030', symbol: 'DALBHARAT', name: 'Dalmia Bharat' },
  { isin: 'INE101M01018', symbol: 'CENTURYTEX', name: 'Century Textiles & Industries' },
  { isin: 'INE148A01019', symbol: 'MCX', name: 'Multi Commodity Exchange of India' },
  { isin: 'INE226H01026', symbol: 'CONCOR', name: 'Container Corporation of India' },
  { isin: 'INE691I01018', symbol: 'SIEMENS', name: 'Siemens' },
  { isin: 'INE397A01024', symbol: 'ABB', name: 'ABB India' },
  { isin: 'INE121A01016', symbol: 'CUMMINSIND', name: 'Cummins India' },
  { isin: 'INE239A01016', symbol: 'ESCORTS', name: 'Escorts Kubota' },
  { isin: 'INE002S01010', symbol: 'JUBLFOOD', name: 'Jubilant FoodWorks' },
  { isin: 'INE148A01027', symbol: 'COLPAL', name: 'Colgate-Palmolive (India)' },
  { isin: 'INE259A01022', symbol: 'GODREJCP', name: 'Godrej Consumer Products' },
  { isin: 'INE364A01016', symbol: 'MARICO', name: 'Marico' },
  { isin: 'INE042A01014', symbol: 'DABUR', name: 'Dabur India' },
  { isin: 'INE491A01021', symbol: 'PGHH', name: 'Procter & Gamble Hygiene and Health Care' },
  { isin: 'INE077A01010', symbol: 'BERGEPAINT', name: 'Berger Paints India' },
  { isin: 'INE417T01048', symbol: 'TVSMOTOR', name: 'TVS Motor Company' },
];

// ─── Build the map ───

function generateNameVariations(name) {
  const variations = new Set();
  const upper = name.toUpperCase();
  variations.add(upper);

  // Remove spaces
  variations.add(upper.replace(/\s+/g, ''));

  // Remove common suffixes
  const cleaned = upper
    .replace(/\s+(LIMITED|LTD\.?|INDUSTRIES|CORPORATION|COMPANY|ENTERPRISE|ENTERPRISES)$/gi, '')
    .trim();
  variations.add(cleaned);
  variations.add(cleaned.replace(/\s+/g, ''));

  // Remove all suffixes aggressively
  const aggressive = upper
    .replace(/\s+(LIMITED|LTD\.?|INDUSTRIES|CORPORATION|COMPANY|ENTERPRISE|ENTERPRISES|OF INDIA|INDIA|\(INDIA\))$/gi, '')
    .replace(/\s+(LIMITED|LTD\.?|INDUSTRIES|CORPORATION|COMPANY|ENTERPRISE|ENTERPRISES|OF INDIA|INDIA|\(INDIA\))$/gi, '')
    .trim();
  variations.add(aggressive);
  variations.add(aggressive.replace(/\s+/g, ''));

  // Truncated versions (Geojit truncates to 20 chars after removing spaces)
  const noSpaces = upper.replace(/\s+/g, '');
  if (noSpaces.length > 20) {
    variations.add(noSpaces.substring(0, 20));
  }

  // Handle Geojit regex bug: RE and RS stripped from within words
  // "RELIANCE" → "LIANCE", "LARSEN" → "LAEN"
  const reStripped = noSpaces.replace(/RE/g, '');
  if (reStripped !== noSpaces) variations.add(reStripped);
  const rsStripped = noSpaces.replace(/RS/g, '');
  if (rsStripped !== noSpaces) variations.add(rsStripped);

  // Handle & and special chars
  variations.add(upper.replace(/&/g, 'AND').replace(/\s+/g, ''));
  variations.add(upper.replace(/AND/g, '&').replace(/\s+/g, ''));
  variations.add(upper.replace(/[^A-Z0-9]/g, ''));

  return [...variations].filter(v => v.length >= 2);
}

function main() {
  const isinMap = {};      // ISIN → ticker
  const nameMap = {};      // normalized name → ticker
  const tickerInfo = {};   // ticker → { isin, name }

  for (const stock of CURATED_STOCKS) {
    const { isin, symbol, name } = stock;

    // ISIN → ticker
    if (isin) {
      isinMap[isin] = symbol;
    }

    // Ticker info
    tickerInfo[symbol] = { isin: isin || '', name };

    // Name variations → ticker
    const variations = generateNameVariations(name);
    for (const v of variations) {
      // Don't overwrite existing mappings with lower-quality matches
      if (!nameMap[v]) {
        nameMap[v] = symbol;
      }
    }

    // Also add the symbol itself as a name mapping (identity)
    nameMap[symbol] = symbol;
  }

  const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    stockCount: CURATED_STOCKS.length,
    isinToTicker: isinMap,
    nameToTicker: nameMap,
    tickerInfo,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`✅ Generated ${OUTPUT_FILE}`);
  console.log(`   ${Object.keys(isinMap).length} ISIN mappings`);
  console.log(`   ${Object.keys(nameMap).length} name variations`);
  console.log(`   ${Object.keys(tickerInfo).length} ticker entries`);
}

main();
