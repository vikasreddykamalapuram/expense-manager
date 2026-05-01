import { ReactNode } from 'react';
import { classNames } from '../../utils/helpers';

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: { value: number; isPositive: boolean };
  variant?: 'default' | 'income' | 'expense' | 'balance';
  className?: string;
}

const variantStyles = {
  default: 'bg-white border-gray-200',
  income: 'bg-success-50 border-success-500/20',
  expense: 'bg-danger-50 border-danger-500/20',
  balance: 'bg-primary-50 border-primary-500/20',
};

const iconBgStyles = {
  default: 'bg-gray-100 text-gray-600',
  income: 'bg-success-100 text-success-700',
  expense: 'bg-danger-100 text-danger-700',
  balance: 'bg-primary-100 text-primary-700',
};

export function StatCard({ title, value, icon, trend, variant = 'default', className }: StatCardProps) {
  return (
    <div
      className={classNames(
        'rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className={classNames(
              'mt-1 text-xs font-medium',
              trend.isPositive ? 'text-success-600' : 'text-danger-600'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% vs last month
            </p>
          )}
        </div>
        <div className={classNames('rounded-xl p-3', iconBgStyles[variant])}>
          {icon}
        </div>
      </div>
    </div>
  );
}
