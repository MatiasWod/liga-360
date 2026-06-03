import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-2 text-text-primary border border-border-subtle',
  success: 'bg-success-soft text-success-base border border-success-base/30',
  warning: 'bg-warning-soft text-warning-base border border-warning-base/30',
  danger: 'bg-danger-soft text-danger-base border border-danger-base/30',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '' }) => {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
