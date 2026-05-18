import React from 'react';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent-primary text-white hover:bg-accent-hover',
  secondary:
    'bg-surface-1 text-text-primary border border-border-subtle hover:bg-surface-2',
  destructive:
    'bg-danger-soft text-danger-base border border-danger-base/40 hover:bg-danger-base/30',
  ghost:
    'bg-transparent text-text-primary hover:bg-surface-2',
};

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className = '', ...props }) => {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
    />
  );
};
