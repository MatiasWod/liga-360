import React from 'react';
import { Card } from '../../components/ui/Card';

export const OrganizerTeamsPage: React.FC = () => {
  return (
    <Card>
      <h1 className="text-2xl font-semibold text-[#0F2A33]">Equipos de la organizacion</h1>
      <p className="mt-2 text-sm text-slate-600">
        Esta vista muestra los equipos vinculados a los torneos de tu organizacion.
      </p>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Si no ves equipos todavia, verifica que existan inscripciones activas en torneos de tu organizacion.
      </div>
    </Card>
  );
};

