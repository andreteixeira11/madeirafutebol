export interface WPPost {
  id: number;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  date: string;
  link: string;
  _embedded?: {
    'wp:featuredmedia'?: {
      source_url: string;
    }[];
  };
}

export interface APIMatch {
  id: number;
  title?: string;
  competition_id: number;
  matchday?: number | string | null;
  round_id?: string;
  team1: string;
  team2: string;
  team1_id?: string;
  team2_id?: string;
  team1_logo?: string;
  team2_logo?: string;
  team1_score?: number | null;
  team2_score?: number | null;
  score1?: number | string | null;
  score2?: number | string | null;
  score?: string | null;
  result_final?: string | null;
  winner_team_id?: string | null;
  status: string;
  playtime?: string;
  result?: string;
  events?: unknown[];
  date: string;
  permalink?: string;
}

export type APIMatchesResponse = APIMatch[];

export interface APICompetitionRound {
  id: number;
  title: string;
  matches: APIMatch[];
}

export interface APICompetition {
  id: number;
  title?: string;
  name?: string;
  slug?: string;
  logo?: string;
  rounds?: APICompetitionRound[];
}

export interface APICompetitionFullRound {
  id: number;
  title: string;
}

export interface APICompetitionFull {
  id: number;
  title?: string;
  name?: string;
  slug?: string;
  logo?: string;
  permalink?: string;
  rounds?: APICompetitionFullRound[];
  modified?: string;
}

export interface APITeam {
  id: number;
  title: string;
  slug: string;
  logo: string;
  players: { id: number; name: string }[];
  permalink: string;
}

export interface StandingRow {
  teamId: string;
  teamName: string;
  teamLogo: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface APICompetitionDetail {
  competition: {
    id: number;
    name: string;
    logo?: string;
  };
  matchdays: {
    matchday: number;
    matches: APIMatch[];
  }[];
  standings: {
    team?: string;
    team_name?: string;
    team_logo?: string;
    points?: number;
    played?: number;
    won?: number;
    wins?: number;
    draw?: number;
    drawn?: number;
    draws?: number;
    lost?: number;
    losses?: number;
    gf?: number;
    goals_for?: number;
    ga?: number;
    goals_against?: number;
    gd?: number;
    goal_difference?: number;
    team_id?: string | number;
  }[];
}

export const FEATURED_COMPETITIONS: { id: number; shortName: string; order: number }[] = [
  { id: 1, shortName: 'Divisão de Honra', order: 0 },
  { id: 2, shortName: '1ª Divisão', order: 1 },
];
