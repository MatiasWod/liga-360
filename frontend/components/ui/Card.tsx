import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <section
      className={`rounded-xl border border-border-subtle bg-surface-1 p-5 text-text-primary shadow-lg shadow-black/30 ${className}`}
    >
      {children}
    </section>
  );
};
