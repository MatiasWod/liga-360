import React from 'react';
import { Card } from '../components/ui/Card';

export const OrganizerTeamsPage: React.FC = () => {
  return (
    <Card>
      <h1 className="text-2xl font-semibold text-[#0F2A33]">Equipos de la organizacion</h1>
      <p className="mt-2 text-sm text-slate-600">
        Esta vista queda preparada para mostrar equipos que participen en al menos un torneo de tu organizacion.
      </p>
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Pendiente de integracion final con inscripciones para filtrar por torneos de la organizacion.
      </div>
    </Card>
  );
};

