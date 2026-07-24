import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowDown, ArrowUp, Repeat } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { formatCurrency } from '../../../shared/utils/helpers';

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

interface DayData {
  date: string;
  income: number;
  expense: number;
  transactionCount: number;
  hasRecurring: boolean;
  hasBill: boolean;
}

export function FinancialCalendar() {
  const { state } = useAppContext();
  const { transactions, billReminders, recurringRules, settings } = state;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Build day data map
  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayData>();

    // Initialize all days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
      map.set(dateStr, { date: dateStr, income: 0, expense: 0, transactionCount: 0, hasRecurring: false, hasBill: false });
    }

    // Fill transaction data
    const monthTxns = transactions.filter(t => !t.isDeleted && t.date.startsWith(monthStr));
    for (const t of monthTxns) {
      const day = map.get(t.date);
      if (!day) continue;
      if (t.type === 'income') day.income += t.amount;
      else if (t.type === 'expense') day.expense += t.amount;
      day.transactionCount++;
      if (t.isRecurring) day.hasRecurring = true;
    }

    // Mark bill reminder due dates (dueDate is day-of-month number)
    for (const bill of billReminders) {
      if (bill.isDeleted || !bill.isActive) continue;
      const billDateStr = `${monthStr}-${String(bill.dueDate).padStart(2, '0')}`;
      const day = map.get(billDateStr);
      if (day) day.hasBill = true;
    }

    // Mark recurring rule dates
    for (const rule of recurringRules) {
      if (!rule.isActive || rule.isDeleted) continue;
      if (rule.nextDueDate?.startsWith(monthStr)) {
        const day = map.get(rule.nextDueDate);
        if (day) day.hasRecurring = true;
      }
    }

    return map;
  }, [transactions, billReminders, recurringRules, monthStr, daysInMonth]);

  // Selected day's transactions
  const selectedDayTxns = useMemo(() => {
    if (!selectedDate) return [];
    return transactions
      .filter(t => !t.isDeleted && t.date === selectedDate)
      .sort((a, b) => b.amount - a.amount);
  }, [selectedDate, transactions]);

  const monthTotal = useMemo(() => {
    let income = 0, expense = 0;
    for (const d of dayDataMap.values()) {
      income += d.income;
      expense += d.expense;
    }
    return { income, expense };
  }, [dayDataMap]);

  const today = new Date().toISOString().slice(0, 10);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Financial Calendar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Income: <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(monthTotal.income, settings)}</span>
            {' · '}Expense: <span className="text-red-500 font-medium">{formatCurrency(monthTotal.expense, settings)}</span>
          </p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
          {weekDays.map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-16 border-b border-r border-gray-50 dark:border-gray-750" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${monthStr}-${String(dayNum).padStart(2, '0')}`;
            const data = dayDataMap.get(dateStr);
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const hasActivity = data && (data.income > 0 || data.expense > 0 || data.hasBill || data.hasRecurring);

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`h-16 p-1 border-b border-r border-gray-50 dark:border-gray-750 text-left transition-all relative ${
                  isSelected ? 'bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-inset ring-indigo-300 dark:ring-indigo-700' :
                  isToday ? 'bg-blue-50 dark:bg-blue-950/20' :
                  'hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                <span className={`text-xs font-medium ${
                  isToday ? 'text-blue-600 dark:text-blue-400 font-bold' :
                  'text-gray-700 dark:text-gray-300'
                }`}>
                  {dayNum}
                </span>

                {/* Indicators */}
                {hasActivity && (
                  <div className="absolute bottom-1 left-1 right-1 flex items-center gap-0.5">
                    {data.expense > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400" title={`₹${data.expense}`} />
                    )}
                    {data.income > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" title={`₹${data.income}`} />
                    )}
                    {data.hasBill && (
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                    {data.hasRecurring && (
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    )}
                  </div>
                )}

                {/* Amount summary (compact) */}
                {data && data.expense > 0 && (
                  <p className="text-[9px] text-red-500 truncate mt-0.5 leading-tight">
                    -{(data.expense / 1000).toFixed(data.expense >= 10000 ? 0 : 1)}k
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Expense</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Income</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Bill Due</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400" /> Recurring</span>
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 animate-fade-in-up">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          {selectedDayTxns.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">No transactions on this day</p>
          ) : (
            <div className="space-y-2">
              {selectedDayTxns.map(t => {
                const cat = state.categories.find(c => c.id === t.categoryId);
                return (
                  <div key={t.id} className="flex items-center gap-3 py-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      t.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {t.type === 'income' ? <ArrowDown className="w-3 h-3 text-emerald-600" /> : <ArrowUp className="w-3 h-3 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {t.notes || cat?.name || 'Transaction'}
                      </p>
                      <p className="text-[10px] text-gray-500">{cat?.name}</p>
                    </div>
                    <span className={`text-sm font-semibold ${
                      t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                    }`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, settings)}
                    </span>
                    {t.isRecurring && <Repeat className="w-3 h-3 text-indigo-400" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
