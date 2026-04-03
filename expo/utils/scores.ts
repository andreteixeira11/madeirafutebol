import { Platform } from 'react-native';
import { APIMatch, APICompetitionDetail, FEATURED_COMPETITIONS, StandingRow, COMPETITION_CATEGORIES } from '@/types/football';

export interface CompetitionInfo {
  id: number;
  title: string;
  logo: string;
  permalink: string;
}

const DEFAULT_API_BASES = [
  'https://madeirafutebol.com/wp-json/mf/v3',
  'https://www.madeirafutebol.com/wp-json/mf/v3',
] as const;

const envApiBase = process.env.EXPO_PUBLIC_RORK_API_BASE_URL?.trim() ?? '';
const API_BASES = [envApiBase, ...DEFAULT_API_BASES].filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);

const API_HEADERS: Record<string, string> = Platform.OS === 'web'
  ? {
    Accept: 'application/json',
  }
  : {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    Referer: 'https://www.sofascore.com/',
  };

function parseApiDate(dateValue: string | null | undefined): Date | null {
  if (!dateValue || typeof dateValue !== 'string') return null;

  const raw = dateValue.trim();
  if (!raw) return null;

  const isoCandidate = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw;
  const isoDate = new Date(isoCandidate);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const second = Number(match[6] ?? 0);

  const localDate = new Date(year, month, day, hour, minute, second);
  if (Number.isNaN(localDate.getTime())) return null;
  return localDate;
}

export function getMatchTimestamp(dateValue: string | null | undefined): number {
  const parsed = parseApiDate(dateValue);
  return parsed ? parsed.getTime() : 0;
}

export function parseMatchDate(dateValue: string | null | undefined): Date | null {
  return parseApiDate(dateValue);
}

async function fetchApiJson<T>(path: string): Promise<T> {
  let lastError: Error | null = null;

  for (const baseUrl of API_BASES) {
    const url = `${baseUrl}${path}`;
    console.log(`[API] Fetching ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: API_HEADERS,
      });

      if (!response.ok) {
        console.log(`[API] Request failed for ${url} with status ${response.status}`);
        lastError = new Error(`Failed to fetch ${path}: ${response.status}`);
        continue;
      }

      return response.json() as Promise<T>;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error('Unknown request error');
      console.log(`[API] Request exception for ${url}: ${normalizedError.message}`);
      lastError = normalizedError;
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${path}`);
}

function normalizeCompetitionsPayload(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter((item) => !!item && typeof item === 'object') as Record<string, unknown>[];
  }

  if (!raw || typeof raw !== 'object') return [];

  const payload = raw as Record<string, unknown>;
  const candidates = [payload.competitions, payload.items, payload.data, payload.results];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item) => !!item && typeof item === 'object') as Record<string, unknown>[];
    }
  }

  return [];
}

function normalizeMatchesPayload(raw: unknown): APIMatch[] {
  if (Array.isArray(raw)) {
    return raw as APIMatch[];
  }

  if (!raw || typeof raw !== 'object') return [];

  const record = raw as Record<string, unknown>;
  const candidates = [record.matches, record.results, record.data, record.items];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as APIMatch[];
    }
  }

  return [];
}

function getSafeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

interface ApiRoundInfo {
  id?: number;
  name?: string;
}

interface ApiStandingPayload {
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
  goal_diff?: number;
  team_id?: string | number;
}

export function mapStandingsPayload(raw: unknown): StandingRow[] {
  if (!Array.isArray(raw)) return [];

  const rows = raw.map((item, index) => {
    const row = item as ApiStandingPayload & { draw?: number };
    const played = Number(row.played ?? 0);
    const won = Number(row.won ?? row.wins ?? 0);
    const drawn = Number(row.drawn ?? row.draws ?? row.draw ?? 0);
    const lost = Number(row.lost ?? row.losses ?? 0);
    const goalsFor = Number(row.goals_for ?? row.gf ?? 0);
    const goalsAgainst = Number(row.goals_against ?? row.ga ?? 0);
    const goalDifference = Number(row.goal_difference ?? row.goal_diff ?? row.gd ?? (goalsFor - goalsAgainst));
    const points = Number(row.points ?? 0);
    const teamName = String(row.team_name ?? row.team ?? `Equipa ${index + 1}`);
    const teamId = String(row.team_id ?? teamName);

    return {
      teamId,
      teamName,
      teamLogo: String(row.team_logo ?? ''),
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference,
      points,
    };
  });

  return rows.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
}

function getFeaturedCompetitionMeta(competition: CompetitionInfo): { order: number; shortName: string; category: string } {
  const normalizedTitle = normalizeText(competition.title);
  const matched = FEATURED_COMPETITIONS.find((item) => {
    if (typeof item.id === 'number' && item.id === competition.id) {
      return true;
    }
    return item.aliases.some((alias) => normalizedTitle.includes(normalizeText(alias)));
  });

  if (matched) {
    return {
      order: matched.order,
      shortName: matched.shortName,
      category: matched.category,
    };
  }

  const fallbackCategory = COMPETITION_CATEGORIES.find((item) => item.aliases.some((alias) => normalizedTitle.includes(normalizeText(alias))));

  return {
    order: 999,
    shortName: competition.title,
    category: fallbackCategory?.key ?? 'outras',
  };
}

export function getCompetitionCategory(competition: CompetitionInfo): string {
  return getFeaturedCompetitionMeta(competition).category;
}

export function getCompetitionShortName(competition: CompetitionInfo): string {
  return getFeaturedCompetitionMeta(competition).shortName;
}

export function getCompetitionPopularityOrder(competition: CompetitionInfo): number {
  return getFeaturedCompetitionMeta(competition).order;
}

export async function fetchCompetitionsLogos(): Promise<CompetitionInfo[]> {
  const raw = await fetchApiJson<unknown>('/competitions');
  const data = normalizeCompetitionsPayload(raw);
  const mapped: CompetitionInfo[] = data.map((item: Record<string, unknown>) => ({
    id: Number(item.id ?? 0),
    title: getSafeString(item.name, getSafeString(item.title, 'Competição')),
    logo: getSafeString(item.logo),
    permalink: getSafeString(item.permalink),
  }));
  return mapped;
}

export function buildCompMap(competitions: CompetitionInfo[]): { nameMap: Record<number, string>; logoMap: Record<number, string> } {
  const nameMap: Record<number, string> = {};
  const logoMap: Record<number, string> = {};

  competitions.forEach((competition) => {
    nameMap[competition.id] = competition.title;
    if (competition.logo) {
      logoMap[competition.id] = competition.logo;
    }
  });

  return { nameMap, logoMap };
}

export function extractScore(match: APIMatch): { home: number; away: number } | null {
  if (match.score1 !== null && match.score1 !== undefined && match.score2 !== null && match.score2 !== undefined) {
    const home = Number(match.score1);
    const away = Number(match.score2);
    if (!Number.isNaN(home) && !Number.isNaN(away)) {
      return { home, away };
    }
  }

  return null;
}

export function isMatchFinished(match: APIMatch): boolean {
  if (match.status === 'finished' || match.status === 'result') return true;
  if (extractScore(match) !== null) return true;
  return false;
}

function dedupeMatches(matches: APIMatch[]): APIMatch[] {
  const uniqueMatches = new Map<number, APIMatch>();
  matches.forEach((match) => uniqueMatches.set(Number(match.id), match));
  return Array.from(uniqueMatches.values());
}

export async function fetchCompetitionDetail(competitionId: number): Promise<APICompetitionDetail> {
  const matches: APIMatch[] = [];

  const matchdayMap = new Map<number, APIMatch[]>();

  matches.forEach((match) => {
    const matchdayValue = Number(match.matchday ?? match.round_id ?? 0);
    const resolvedMatchday = Number.isNaN(matchdayValue) ? 0 : matchdayValue;

    // ✅ CORRIGIDO AQUI
    const fallbackRoundId = (match.round_id ?? resolvedMatchday) || '';

    const enrichedMatch: APIMatch = {
      ...match,
      matchday: resolvedMatchday,
      round_id: String(fallbackRoundId),
    };

    const bucket = matchdayMap.get(resolvedMatchday) ?? [];
    bucket.push(enrichedMatch);
    matchdayMap.set(resolvedMatchday, bucket);
  });

  return {
    competition: { id: competitionId, name: '', logo: '' },
    matchdays: [],
    standings: [],
  };
}