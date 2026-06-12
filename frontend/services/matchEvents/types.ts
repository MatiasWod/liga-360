export type MatchEventType =
  | 'goal'
  | 'yellow_card'
  | 'red_card'
  | 'suspension'
  | 'other_sanction'
  | 'tennis_set';

export interface MatchEvent {
  id: number;
  match_id: string;
  tournament_id: string;
  competition_id: string | null;
  event_type: MatchEventType;
  inscription_id: number | null;
  linked_member_id: number | null;
  display_name: string;
  minute: number | null;
  suspension_matches: number | null;
  /** Solo presente con token de organizador (excluido en lecturas públicas). */
  notes?: string | null;
  extra_json: Record<string, unknown> | null;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMatchEventPayload {
  tournament_id: string;
  competition_id?: string | null;
  event_type: MatchEventType;
  display_name: string;
  inscription_id?: number | null;
  linked_member_id?: number | null;
  minute?: number | null;
  suspension_matches?: number | null;
  notes?: string | null;
  extra_json?: Record<string, unknown> | null;
}

export interface UpdateMatchEventPayload {
  event_type?: MatchEventType;
  display_name?: string;
  competition_id?: string | null;
  inscription_id?: number | null;
  linked_member_id?: number | null;
  minute?: number | null;
  suspension_matches?: number | null;
  notes?: string | null;
  extra_json?: Record<string, unknown> | null;
}
