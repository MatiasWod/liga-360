import React from 'react';
import { Card } from '../components/ui/Card';

interface TournamentItem {
  id: string;
  name: string;
  sport?: string;
}

interface ParticipantTournamentsPageProps {
  teamTournaments: TournamentItem[];
  individualTournaments: TournamentItem[];
}

function TournamentList({ title, items }: { title: string; items: TournamentItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <h2 className="text-lg font-semibold text-[#0F2A33]">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 p-3">
            <h3 className="font-medium text-slate-800">{item.name}</h3>
            <p className="text-xs text-slate-500">
              ID: {item.id}
              {item.sport ? ` • ${item.sport}` : ''}
            </p>
          </article>
        ))}
      </div>
    </Card>
  );
}

export const ParticipantTournamentsPage: React.FC<ParticipantTournamentsPageProps> = ({
  teamTournaments,
  individualTournaments,
}) => {
  const hasAny = teamTournaments.length > 0 || individualTournaments.length > 0;
  if (!hasAny) {
    return (
      <Card>
        <h1 className="text-2xl font-semibold text-[#0F2A33]">Torneos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Aun no participas en torneos. Cuando tengas inscripciones activas, se mostraran separadas por equipo o individual.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <TournamentList title="Torneos por equipo" items={teamTournaments} />
      <TournamentList title="Torneos individuales" items={individualTournaments} />
    </div>
  );
};

