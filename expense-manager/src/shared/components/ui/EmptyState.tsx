import { ReactNode } from 'react';
import { classNames } from '../../utils/helpers';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={classNames('flex flex-col items-center justify-center py-12 text-center animate-fade-in-up', className)}>
      <div className="mb-4 rounded-2xl bg-gray-100 p-5 text-gray-400 dark:bg-gray-700 dark:text-gray-500 shadow-inner">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
