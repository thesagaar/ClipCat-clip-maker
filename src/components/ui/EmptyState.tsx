import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-xl bg-ios-surface border border-ios-sep px-6 py-12">
      <div className="w-12 h-12 rounded-xl bg-ios-tertiary border border-ios-sep flex items-center justify-center text-ios-secondary mb-4">
        {icon}
      </div>
      <h3 className="font-display text-lg font-bold text-ios-label">{title}</h3>
      <p className="text-sm text-ios-secondary max-w-md mt-1.5 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
