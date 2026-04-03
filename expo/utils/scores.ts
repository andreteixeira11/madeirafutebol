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
const API_BASES = [envApiBase, ...DEFAULT_API_BASES].filter(
  (value, index, array) => value.length > 0 && array.indexOf(value) === index
);

const API_HEADERS: Record<string, string> =
  Platform.OS === 'web'
    ? {
        Accept: 'application/json',
      }
    : {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        Referer: 'https://www.sofascore.com/',
      };

function parseApiDate(dateValue: string | null | undefined): Date | null {
  if (!dateValue || typeof dateValue !== 'string') return null;

  const raw = dateValue.trim();
  if (!raw) return null;

  const isoCandidate =
    raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw;

  const isoDate = new Date(isoCandidate);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
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
        lastError = new Error(`Failed to fetch ${path}: ${response.status}`);
        continue;
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Unknown request error');
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${path}`);
}

function normalizeMatchesPayload(raw: unknown): APIMatch[] {
  if (Array.isArray(raw)) return raw as APIMatch[];
  if (!raw || typeof raw !== 'object') return [];

  const record = raw as Record<string, unknown>;
  const candidates = [record.matches, record.results, record.data, record.items];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as APIMatch[];
  }

  return [];
}

function dedupeMatches(matches: APIMatch[]): APIMatch[] {
  const uniqueMatches = new Map<number, APIMatch>();
  matches.forEach((match) =>
    uniqueMatches.set(Number(match.id), match)
  );
  return Array.from(uniqueMatches.values());
}

export async function fetchCompetitionDetail(
  competitionId: number
): Promise<APICompetitionDetail> {
  const raw = await fetchApiJson<unknown>(
    `/matches?competition_id=${competitionId}`
  );

  const matches = dedupeMatches(normalizeMatchesPayload(raw));

  const matchdayMap = new Map<number, APIMatch[]>();

  matches.forEach((match) => {
    const matchdayValue = Number(match.matchday ?? match.round_id ?? 0);
    const resolvedMatchday = Number.isNaN(matchdayValue) ? 0 : matchdayValue;

    // ✅ CORREÇÃO SEGURA
    const fallbackRoundId =
      match.round_id ??
      (resolvedMatchday !== 0 ? resolvedMatchday : '');

    const enrichedMatch: APIMatch = {
      ...match,
      matchday: resolvedMatchday,
      round_id: String(fallbackRoundId),
    };

    const bucket = matchdayMap.get(resolvedMatchday) ?? [];
    bucket.push(enrichedMatch);
    matchdayMap.set(resolvedMatchday, bucket);
  });

  const matchdays = Array.from(matchdayMap.entries()).map(
    ([matchday, matches]) => ({
      matchday,
      matches,
    })
  );

  return {
    competition: { id: competitionId, name: '', logo: '' },
    matchdays,
    standings: [],
  };
}