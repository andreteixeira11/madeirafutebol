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

export interface CompetitionCategory {
  key: string;
  title: string;
  aliases: string[];
}

export interface FeaturedCompetition {
  id?: number;
  shortName: string;
  order: number;
  category: string;
  aliases: string[];
}

export const COMPETITION_CATEGORIES: CompetitionCategory[] = [
  {
    key: 'seniores',
    title: 'Competições Principais',
    aliases: [
      'i liga',
      'ii liga',
      'campeonato de portugal',
      'liga revelação',
      'divisão de honra regional',
      'campeonato regional 1 divisao seniores',
      'campeonato regional 1 divisão seniores',
    ],
  },
  {
    key: 'femininos',
    title: 'Femininos',
    aliases: ['campeonato nacional bpi', 'femininos regionais', 'feminino', 'femininos'],
  },
  {
    key: 'formacao',
    title: 'Futebol de Formação',
    aliases: ['sub-', 'juniores', 'juvenis', 'iniciados', 'infantis', 'formação', 'formacao'],
  },
  {
    key: 'tacas',
    title: 'Taças',
    aliases: ['taça', 'taca', 'cup'],
  },
  {
    key: 'futsal',
    title: 'Futsal',
    aliases: ['futsal'],
  },
  {
    key: 'outras',
    title: 'Outras Competições',
    aliases: [],
  },
];

export const FEATURED_COMPETITIONS: FeaturedCompetition[] = [
  { id: 1075, shortName: 'I Liga', order: 0, category: 'seniores', aliases: ['i liga', 'liga portugal', 'primeira liga'] },
  { shortName: 'II Liga', order: 1, category: 'seniores', aliases: ['ii liga', 'liga 2', 'segunda liga'] },
  { shortName: 'Campeonato de Portugal', order: 2, category: 'seniores', aliases: ['campeonato de portugal'] },
  { shortName: 'Liga Revelação', order: 3, category: 'seniores', aliases: ['liga revelação', 'liga revelacao'] },
  { id: 1, shortName: 'Divisão de Honra Regional', order: 4, category: 'seniores', aliases: ['divisão de honra regional', 'divisao de honra regional', 'divisão de honra'] },
  { id: 2, shortName: 'Campeonato Regional 1 Divisão Seniores', order: 5, category: 'seniores', aliases: ['campeonato regional 1 divisao seniores', 'campeonato regional 1 divisão seniores', '1ª divisão regional', '1 divisao regional'] },
  { shortName: 'Campeonato Nacional BPI', order: 6, category: 'femininos', aliases: ['campeonato nacional bpi', 'bpi'] },
  { shortName: 'Femininos Regionais', order: 7, category: 'femininos', aliases: ['femininos regionais', 'regional feminino'] },
  { shortName: 'Futebol de Formação', order: 8, category: 'formacao', aliases: ['sub-', 'juniores', 'juvenis', 'iniciados', 'infantis'] },
  { shortName: 'Taças', order: 9, category: 'tacas', aliases: ['taça', 'taca'] },
  { shortName: 'Futsal', order: 10, category: 'futsal', aliases: ['futsal'] },
];
