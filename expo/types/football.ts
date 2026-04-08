export interface WPPost {
  id: number;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  date: string;
  link: string;
  yoast_head_json?: {
    author?: string;
  };
  _embedded?: {
    author?: {
      name?: string;
    }[];
    'wp:featuredmedia'?: {
      source_url: string;
      caption?: {
        rendered?: string;
      };
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
    key: 'futsal',
    title: 'Futsal',
    aliases: ['futsal'],
  },
  {
    key: 'juniores',
    title: 'Juniores',
    aliases: ['juniores', 'sub-19', 'sub 19', 'u19'],
  },
  {
    key: 'juvenis',
    title: 'Juvenis',
    aliases: ['juvenis', 'sub-17', 'sub 17', 'u17'],
  },
  {
    key: 'iniciados',
    title: 'Iniciados',
    aliases: ['iniciados', 'sub-15', 'sub 15', 'u15'],
  },
  {
    key: 'infantis',
    title: 'Infantis',
    aliases: ['infantis'],
  },
  {
    key: 'sub13',
    title: 'Sub-13',
    aliases: ['sub-13', 'sub 13', 'u13'],
  },
  {
    key: 'sub12',
    title: 'Sub-12',
    aliases: ['sub-12', 'sub 12', 'u12'],
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
    key: 'outras',
    title: 'Outras Competições',
    aliases: [],
  },
];

export const FEATURED_COMPETITIONS: FeaturedCompetition[] = [
  { id: 1075, shortName: 'I Liga', order: 0, category: 'seniores', aliases: ['i liga', 'liga portugal betclic', 'primeira liga'] },
  { shortName: 'II Liga', order: 1, category: 'seniores', aliases: ['ii liga', 'liga portugal 2 meu super', 'liga 2', 'segunda liga', 'meu super'] },
  { shortName: 'Campeonato de Portugal', order: 2, category: 'seniores', aliases: ['campeonato de portugal'] },
  { shortName: 'Liga Revelação', order: 3, category: 'seniores', aliases: ['liga revelação', 'liga revelacao'] },
  { id: 1, shortName: 'Divisão de Honra Regional', order: 4, category: 'seniores', aliases: ['divisão de honra regional', 'divisao de honra regional', 'divisão de honra'] },
  { id: 2, shortName: 'Campeonato Regional 1 Divisão Seniores', order: 5, category: 'seniores', aliases: ['campeonato regional 1 divisao seniores', 'campeonato regional 1 divisão seniores', '1ª divisão regional', '1 divisao regional'] },
  { shortName: 'Campeonato Nacional BPI', order: 6, category: 'femininos', aliases: ['campeonato nacional bpi', 'bpi'] },
  { shortName: 'Femininos Regionais', order: 7, category: 'femininos', aliases: ['femininos regionais', 'regional feminino'] },
  { shortName: 'Futsal', order: 8, category: 'futsal', aliases: ['futsal'] },
  { shortName: 'Juniores', order: 9, category: 'juniores', aliases: ['juniores', 'sub-19', 'sub 19', 'u19'] },
  { shortName: 'Juvenis', order: 10, category: 'juvenis', aliases: ['juvenis', 'sub-17', 'sub 17', 'u17'] },
  { shortName: 'Iniciados', order: 11, category: 'iniciados', aliases: ['iniciados', 'sub-15', 'sub 15', 'u15'] },
  { shortName: 'Infantis', order: 12, category: 'infantis', aliases: ['infantis'] },
  { shortName: 'Sub-13', order: 13, category: 'sub13', aliases: ['sub-13', 'sub 13', 'u13'] },
  { shortName: 'Sub-12', order: 14, category: 'sub12', aliases: ['sub-12', 'sub 12', 'u12'] },
  { shortName: 'Futebol de Formação', order: 15, category: 'formacao', aliases: ['sub-', 'juniores', 'juvenis', 'iniciados', 'infantis'] },
  { shortName: 'Taças', order: 16, category: 'tacas', aliases: ['taça', 'taca'] },
];
