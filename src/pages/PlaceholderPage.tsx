import React from 'react';
import { Card } from '../components/ui/Card';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, description }) => {
  return (
    <Card>
      <h1 className="text-2xl font-semibold text-[#0F2A33]">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </Card>
  );
};

