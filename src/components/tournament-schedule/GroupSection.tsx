import React from 'react';

interface GroupSectionProps {
  title: string;
  children: React.ReactNode;
  theme?: 'light' | 'dark';
  className?: string;
}

export const GroupSection: React.FC<GroupSectionProps> = ({
  title,
  children,
  theme = 'light',
  className = '',
}) => {
  const isDark = theme === 'dark';
  return (
    <section
      className={`rounded-xl border p-4 min-w-0 ${
        isDark ? 'border-white/15 bg-white/5' : 'border-slate-200 bg-slate-50/50'
      } ${className}`}
    >
      <h3
        className={`mb-3 text-xs font-bold uppercase tracking-wider ${
          isDark ? 'text-white/55' : 'text-slate-500'
        }`}
      >
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
};
