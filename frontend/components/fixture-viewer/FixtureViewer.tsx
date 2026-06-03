import React from 'react';
import { FixtureViewerGroups } from './FixtureViewerGroups';
import { FixtureViewerLeagueKnockout } from './FixtureViewerLeagueKnockout';
import type { FixtureViewerProps } from './types';

/**
 * Fixture reutilizable: visualización (solo lectura) o edición (selects, fecha/hora, drag & drop).
 *
 * - `layout: "league" | "knockout"` + `fixture: Round[]`
 * - `layout: "groups"` + `groups: { id, name, rounds }[]`
 *
 * En edición, los `id` de partidos deben ser únicos en todo el modelo que enviás en `onChange`.
 */
export const FixtureViewer: React.FC<FixtureViewerProps> = (props) => {
  if (props.layout === 'groups') {
    return (
      <FixtureViewerGroups
        mode={props.mode}
        layout="groups"
        groups={props.groups}
        teams={props.teams}
        onChange={props.onChange}
        theme={props.theme}
        className={props.className}
        disableDragDrop={props.disableDragDrop}
        disableStructureEdit={props.disableStructureEdit}
        scoreEditing={props.scoreEditing}
        schedulingAssistForScope={props.schedulingAssistForScope}
      />
    );
  }

  return (
    <FixtureViewerLeagueKnockout
      mode={props.mode}
      layout={props.layout ?? 'league'}
      fixture={props.fixture}
      teams={props.teams}
      onChange={props.onChange}
      theme={props.theme}
      className={props.className}
      disableDragDrop={props.disableDragDrop}
      disableStructureEdit={props.disableStructureEdit}
      scoreEditing={props.scoreEditing}
      schedulingAssist={props.schedulingAssistForScope?.('main') ?? null}
    />
  );
};
