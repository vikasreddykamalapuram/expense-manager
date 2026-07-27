import { Settings } from '../types';

export const formatCurrency = (amount: number, settings: Settings): string => {
  return `${settings.currencySymbol}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/** Compact format for chart Y-axis labels (e.g., ₹4.2L, ₹50K, ₹800) */
export const formatCurrencyCompact = (amount: number, settings: Settings): string => {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}${settings.currencySymbol}${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}${settings.currencySymbol}${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}${settings.currencySymbol}${(abs / 1000).toFixed(1)}K`;
  return `${sign}${settings.currencySymbol}${abs.toFixed(0)}`;
};

export const formatDate = (dateStr: string, format: string = 'DD/MM/YYYY'): string => {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  switch (format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD MMM YYYY': {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${monthNames[date.getMonth()]} ${year}`;
    }
    default:
      return `${day}/${month}/${year}`;
  }
};

export const getCurrentYear = (): string => {
  return new Date().getFullYear().toString();
};

export const getYearRange = (year: string): { start: string; end: string } => {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
};

/** Get ISO week number and year for a date string (YYYY-MM-DD) */
export const getWeekInfo = (dateStr: string): { year: number; week: number } => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { year: d.getFullYear(), week };
};

/** Get the current week as "YYYY-Www" */
export const getCurrentWeek = (): string => {
  const today = getToday();
  const { year, week } = getWeekInfo(today);
  return `${year}-W${week.toString().padStart(2, '0')}`;
};

/** Parse "YYYY-Www" into start (Monday) and end (Sunday) dates */
export const getWeekRange = (weekStr: string): { start: string; end: string } => {
  const [yearStr, wStr] = weekStr.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(wStr);
  // Jan 4 is always in week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = (jan4.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  return { start: fmt(monday), end: fmt(sunday) };
};

/** Format "YYYY-Www" to readable string like "Apr 28 – May 4, 2026" */
export const formatWeek = (weekStr: string): string => {
  const { start, end } = getWeekRange(weekStr);
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (s.getMonth() === e.getMonth()) {
    return `${monthNames[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${monthNames[s.getMonth()]} ${s.getDate()} – ${monthNames[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
};

export const getPreviousWeek = (weekStr: string): string => {
  const { start } = getWeekRange(weekStr);
  const d = new Date(start + 'T00:00:00');
  d.setDate(d.getDate() - 7);
  const fmt = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  const { year, week } = getWeekInfo(fmt);
  return `${year}-W${week.toString().padStart(2, '0')}`;
};

export const getNextWeek = (weekStr: string): string => {
  const { start } = getWeekRange(weekStr);
  const d = new Date(start + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  const fmt = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  const { year, week } = getWeekInfo(fmt);
  return `${year}-W${week.toString().padStart(2, '0')}`;
};

export const formatMonth = (monthStr: string): string => {
  const [year, month] = monthStr.split('-');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
};

export const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
};

export const getMonthRange = (monthStr: string): { start: string; end: string } => {
  const [year, month] = monthStr.split('-').map(Number);
  const start = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
  return { start, end };
};

export const getPreviousMonth = (monthStr: string): string => {
  const [year, month] = monthStr.split('-').map(Number);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${(month - 1).toString().padStart(2, '0')}`;
};

export const getNextMonth = (monthStr: string): string => {
  const [year, month] = monthStr.split('-').map(Number);
  if (month === 12) return `${year + 1}-01`;
  return `${year}-${(month + 1).toString().padStart(2, '0')}`;
};

export const getLast6Months = (): string[] => {
  const months: string[] = [];
  let current = getCurrentMonth();
  for (let i = 0; i < 6; i++) {
    months.unshift(current);
    current = getPreviousMonth(current);
  }
  return months;
};

// ─── Period utilities (multi-period reports) ──────────────

export type PeriodKind = 'month' | 'quarter' | 'year' | 'custom';

export interface Period {
  kind: PeriodKind;
  /** For month: YYYY-MM. Quarter: YYYY-Qn. Year: YYYY. Custom: start date. */
  anchor: string;
  /** Inclusive start date, YYYY-MM-DD */
  start: string;
  /** Inclusive end date, YYYY-MM-DD */
  end: string;
  /** Human label, e.g. "July 2026", "Q3 2026", "2026", "Apr 1 – Jun 30, 2026" */
  label: string;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_ABBR  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const pad2 = (n: number) => n.toString().padStart(2, '0');
const isoDate = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

export const buildPeriod = (kind: PeriodKind, anchor: string, customEnd?: string): Period => {
  if (kind === 'month') {
    const [y, m] = anchor.split('-').map(Number);
    return {
      kind, anchor,
      start: isoDate(y, m, 1),
      end:   isoDate(y, m, daysInMonth(y, m)),
      label: `${MONTH_NAMES[m - 1]} ${y}`,
    };
  }
  if (kind === 'quarter') {
    // anchor "YYYY-Qn"
    const [ys, qs] = anchor.split('-Q');
    const y = Number(ys), q = Number(qs);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth   = startMonth + 2;
    return {
      kind, anchor,
      start: isoDate(y, startMonth, 1),
      end:   isoDate(y, endMonth, daysInMonth(y, endMonth)),
      label: `Q${q} ${y}`,
    };
  }
  if (kind === 'year') {
    const y = Number(anchor);
    return {
      kind, anchor,
      start: isoDate(y, 1, 1),
      end:   isoDate(y, 12, 31),
      label: `${y}`,
    };
  }
  // custom — anchor is start date, customEnd is inclusive end
  const start = anchor;
  const end = customEnd || anchor;
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const sameYear = sy === ey;
  const label = sameYear
    ? `${MONTH_ABBR[sm - 1]} ${sd} – ${MONTH_ABBR[em - 1]} ${ed}, ${sy}`
    : `${MONTH_ABBR[sm - 1]} ${sd}, ${sy} – ${MONTH_ABBR[em - 1]} ${ed}, ${ey}`;
  return { kind: 'custom', anchor, start, end, label };
};

export const currentPeriod = (kind: PeriodKind): Period => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (kind === 'month')   return buildPeriod('month', `${y}-${pad2(m)}`);
  if (kind === 'quarter') return buildPeriod('quarter', `${y}-Q${Math.floor((m - 1) / 3) + 1}`);
  if (kind === 'year')    return buildPeriod('year', `${y}`);
  const start = isoDate(y, m, 1);
  const end   = isoDate(y, m, daysInMonth(y, m));
  return buildPeriod('custom', start, end);
};

/** Move a period by one step (±1). Custom periods shift by their own length. */
export const shiftPeriod = (p: Period, delta: 1 | -1): Period => {
  if (p.kind === 'month') {
    const [y, m] = p.anchor.split('-').map(Number);
    const total = y * 12 + (m - 1) + delta;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return buildPeriod('month', `${ny}-${pad2(nm)}`);
  }
  if (p.kind === 'quarter') {
    const [ys, qs] = p.anchor.split('-Q');
    const total = Number(ys) * 4 + (Number(qs) - 1) + delta;
    const ny = Math.floor(total / 4);
    const nq = (total % 4) + 1;
    return buildPeriod('quarter', `${ny}-Q${nq}`);
  }
  if (p.kind === 'year') {
    return buildPeriod('year', `${Number(p.anchor) + delta}`);
  }
  // custom — shift by exact span length in days
  const start = new Date(p.start);
  const end   = new Date(p.end);
  const spanDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const shift = spanDays * delta;
  const nStart = new Date(start.getTime() + shift * 86400000);
  const nEnd   = new Date(end.getTime()   + shift * 86400000);
  const s = nStart.toISOString().slice(0, 10);
  const e = nEnd.toISOString().slice(0, 10);
  return buildPeriod('custom', s, e);
};

/** Previous equivalent period (used for comparison in reports). */
export const previousPeriod = (p: Period): Period => shiftPeriod(p, -1);

/** Months (YYYY-MM) that overlap this period. Used for budget aggregation. */
export const monthsInPeriod = (p: Period): string[] => {
  const [sy, sm] = p.start.split('-').map(Number);
  const [ey, em] = p.end.split('-').map(Number);
  const out: string[] = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${pad2(m)}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
};

export const getToday = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

export const downloadFile = (content: string, filename: string, type: string = 'application/json'): void => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const classNames = (...classes: (string | boolean | undefined)[]): string => {
  return classes.filter(Boolean).join(' ');
};
