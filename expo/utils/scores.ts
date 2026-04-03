import { APIMatch, APICompetitionDetail } from '@/types/football';

export interface CompetitionInfo {
  id: number;
  title: string;
  logo: string;
  permalink: string;
}

const API_BASE = process.env.EXPO_PUBLIC_RORK_API_BASE_URL?.trim() || 'https://www.madeirafutebol.com/wp-json/mf/v3';

const API_HEADERS: Record<string, string> = {
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
  const url = `${API_BASE}${path}`;
  console.log(`[API] Fetching ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: API_HEADERS,
  });

  if (!response.ok) {
    console.log(`[API] Request failed for ${url} with status ${response.status}`);
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  return response.json() as Promise<T>;
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

export async function fetchCompetitionsLogos(): Promise<CompetitionInfo[]> {
  const raw = await fetchApiJson<unknown>('/competitions');
  const data = normalizeCompetitionsPayload(raw);
  const mapped: CompetitionInfo[] = data.map((item: Record<string, unknown>) => ({
    id: Number(item.id ?? 0),
    title: getSafeString(item.name, getSafeString(item.title, 'Competição')),
    logo: getSafeString(item.logo),
    permalink: getSafeString(item.permalink),
  }));
  console.log(`[Competitions] Fetched ${mapped.length} competitions with logos`);
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

  if (match.team1_score !== null && match.team1_score !== undefined && match.team2_score !== null && match.team2_score !== undefined) {
    const home = Number(match.team1_score);
    const away = Number(match.team2_score);
    if (!Number.isNaN(home) && !Number.isNaN(away)) {
      return { home, away };
    }
  }

  const scoreCandidates = [match.score, match.result_final, match.result];

  for (const candidate of scoreCandidates) {
    if (!candidate || typeof candidate !== 'string') continue;
    const parts = candidate.split(/[-–:xX]/);
    if (parts.length !== 2) continue;

    const home = parseInt(parts[0].trim(), 10);
    const away = parseInt(parts[1].trim(), 10);
    if (!Number.isNaN(home) && !Number.isNaN(away)) {
      return { home, away };
    }
  }

  return null;
}

export function isMatchFinished(match: APIMatch): boolean {
  if (match.status === 'finished' || match.status === 'result') return true;
  if (extractScore(match) !== null) return true;
  if (match.result_final !== null && match.result_final !== undefined && match.result_final !== '') return true;
  if (match.winner_team_id !== null && match.winner_team_id !== undefined) return true;
  return false;
}

export function isMatchLive(match: APIMatch): boolean {
  return match.status === 'live';
}

export async function fetchAllMatches(): Promise<APIMatch[]> {
  const raw = await fetchApiJson<unknown>('/matches');
  const data = normalizeMatchesPayload(raw);
  console.log(`[Matches] /matches returned ${data.length} items`);
  return data.sort((a, b) => getMatchTimestamp(a.date) - getMatchTimestamp(b.date));
}

export async function fetchResults(): Promise<APIMatch[]> {
  const data = await fetchAllMatches();
  return data.filter((match) => isMatchFinished(match) || isMatchLive(match));
}

export async function fetchAllMatchesMerged(): Promise<APIMatch[]> {
  return fetchAllMatches();
}

export async function fetchCompetitionDetail(competitionId: number, matchday?: number): Promise<APICompetitionDetail> {
  const query = matchday ? `&matchday=${matchday}` : '';

  const [competitionsRaw, matchesRaw, standingsRaw, roundsRaw] = await Promise.all([
    fetchApiJson<unknown>('/competitions'),
    fetchApiJson<unknown>(`/matches?competition_id=${competitionId}${query}`),
    fetchApiJson<unknown>(`/competition/${competitionId}/standings`),
    fetchApiJson<unknown>(`/competition/${competitionId}/rounds`),
  ]);

  const competitions = normalizeCompetitionsPayload(competitionsRaw);
  const matches = normalizeMatchesPayload(matchesRaw).map((match) => ({
    ...match,
    competition_id: Number(match.competition_id ?? competitionId),
  }));
  const standings = Array.isArray(standingsRaw) ? (standingsRaw as ApiStandingPayload[]) : [];
  const rounds = Array.isArray(roundsRaw) ? (roundsRaw as ApiRoundInfo[]) : [];

  const competitionRecord = competitions.find((item) => Number(item.id ?? 0) === competitionId);
  const roundMap = new Map<number, string>();
  rounds.forEach((round) => {
    const roundId = Number(round.id ?? 0);
    if (roundId > 0) {
      roundMap.set(roundId, String(round.name ?? `Jornada ${roundId}`));
    }
  });

  const matchdayMap = new Map<number, APIMatch[]>();

  matches.forEach((match) => {
    const matchdayValue = Number(match.matchday ?? match.round_id ?? 0);
    const resolvedMatchday = Number.isNaN(matchdayValue) ? 0 : matchdayValue;
    const enrichedMatch: APIMatch = {
      ...match,
      competition_id: Number(match.competition_id ?? competitionId),
      matchday: resolvedMatchday,
      round_id: String(match.round_id ?? resolvedMatchday ?? ''),
      title: match.title ?? `${match.team1} x ${match.team2}`,
      result_final: match.result_final ?? match.score ?? null,
    };

    if (resolvedMatchday > 0 && roundMap.has(resolvedMatchday)) {
      enrichedMatch.round_id = roundMap.get(resolvedMatchday);
    }

    const bucketKey = resolvedMatchday > 0 ? resolvedMatchday : 0;
    const bucket = matchdayMap.get(bucketKey) ?? [];
    bucket.push(enrichedMatch);
    matchdayMap.set(bucketKey, bucket);
  });

  const matchdays = Array.from(matchdayMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([matchdayNumber, bucket]) => ({
      matchday: matchdayNumber,
      matches: [...bucket].sort((a, b) => getMatchTimestamp(a.date) - getMatchTimestamp(b.date)),
    }));

  return {
    competition: {
      id: competitionId,
      name: getSafeString(competitionRecord?.name, getSafeString(competitionRecord?.title, 'Competição')),
      logo: getSafeString(competitionRecord?.logo),
    },
    matchdays,
    standings: standings as APICompetitionDetail['standings'],
  };
}
