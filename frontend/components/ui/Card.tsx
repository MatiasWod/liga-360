import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'dark' | 'light';
}

export const Card: React.FC<CardProps> = ({ children, className = '', variant = 'dark' }) => {
  const variantClass =
    variant === 'light'
      ? 'border-slate-200 bg-white text-[#0F2A33] shadow-sm shadow-slate-200/60'
      : 'border-border-subtle bg-surface-1 text-text-primary shadow-lg shadow-black/30';

  return (
    <section className={`rounded-xl border p-5 ${variantClass} ${className}`}>
      {children}
    </section>
  );
};
