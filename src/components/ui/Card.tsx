import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <section className={`rounded-xl bg-white p-5 shadow-md ${className}`}>
      {children}
    </section>
  );
};

