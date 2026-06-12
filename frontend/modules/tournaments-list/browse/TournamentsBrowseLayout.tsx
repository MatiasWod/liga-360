import React from 'react';
import { OrganizersPanel, type OrganizersPanelProps } from './OrganizersPanel';

type TournamentsBrowseLayoutProps = {
  panel: OrganizersPanelProps;
  children: React.ReactNode;
  showPanel?: boolean;
};

export const TournamentsBrowseLayout: React.FC<TournamentsBrowseLayoutProps> = ({
  panel,
  children,
  showPanel = true,
}) => {
  if (!showPanel) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <OrganizersPanel {...panel} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};
