import { Settings } from '../types';

export const formatCurrency = (amount: number, settings: Settings): string => {
  return `${settings.currencySymbol}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
