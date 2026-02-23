import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-[#EAF7EB] text-[#2E7D32]',
  warning: 'bg-[#FFF8E7] text-[#8A6D1A]',
  danger: 'bg-[#FDECEC] text-[#B42318]',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '' }) => {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

