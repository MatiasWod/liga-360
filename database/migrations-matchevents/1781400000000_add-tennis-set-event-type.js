/**
 * Extiende event_type de MatchEvent para soportar detalle de sets de tenis.
 * Un evento tennis_set por set con games en extra_json (setNumber, homeGames, awayGames).
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE "MatchEvent" DROP CONSTRAINT IF EXISTS "MatchEvent_event_type_check";

    ALTER TABLE "MatchEvent"
      ADD CONSTRAINT "MatchEvent_event_type_check"
      CHECK (event_type IN (
        'goal', 'yellow_card', 'red_card', 'suspension', 'other_sanction', 'tennis_set'
      ));
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DELETE FROM "MatchEvent" WHERE event_type = 'tennis_set';

    ALTER TABLE "MatchEvent" DROP CONSTRAINT IF EXISTS "MatchEvent_event_type_check";

    ALTER TABLE "MatchEvent"
      ADD CONSTRAINT "MatchEvent_event_type_check"
      CHECK (event_type IN (
        'goal', 'yellow_card', 'red_card', 'suspension', 'other_sanction'
      ));
  `);
};
