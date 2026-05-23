export interface ClassificationZone {
  fromPos: number;
  toPos: number;
  label: string;
  colorIndex: number; // 0=verde, 1=azul, 2=amarillo, 3=naranja, 4+=rojo
  /** Si está seteado: solo los mejores bestNCount equipos de esa posición clasifican (ranking cross-grupo). */
  bestNCount?: number;
}

export interface StandingsRow {
  position: number;
  inscriptionId: string;
  displayName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}
