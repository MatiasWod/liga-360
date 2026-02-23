import React from 'react';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-[#2E7D32] text-white hover:bg-[#256628]',
  secondary: 'bg-white text-[#0F2A33] border border-slate-200 hover:bg-slate-50',
  destructive: 'bg-[#FDECEC] text-[#B42318] border border-[#F9D5D5] hover:bg-[#FBDCDC]',
  ghost: 'bg-transparent text-[#0F2A33] hover:bg-slate-100',
};

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className = '', ...props }) => {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
    />
  );
};

