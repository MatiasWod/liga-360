export interface InscriptionItem {
  id: number;
  tournament_id: string;
  competition_id: string | null;
  competitor_kind?: 'team' | 'participant';
  team_badge_url?: string | null;
  /** Imagen del competidor: escudo del equipo o avatar del participante según el kind. */
  competitor_image_url?: string | null;
  source: 'public' | 'invitation' | 'manual';
  linked_team_id: number | null;
  linked_participant_user_id?: number | null;
  display_name: string;
  status: 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO';
  created_by_user_id: number | null;
  reviewed_by_user_id: number | null;
}

export interface TeamOption {
  id: number;
  name: string;
  badge_url?: string | null;
}

export interface TournamentInvite {
  id: number;
  token: string;
  tournament_id: string;
  competition_id: string | null;
  type: 'public' | 'targeted';
  target_inscription_id: number | null;
  target_team_code?: string | null;
  target_participant_user_id?: number | null;
  status: 'active' | 'revoked';
  invite_response_status?: 'pending' | 'accepted' | 'rejected';
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
  created_at: string;
}
