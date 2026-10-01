import { Platform } from 'react-native';

import {
  APIMatch,
  CompetitionDetail,
  COMPETITION_CATEGORIES,
  FEATURED_COMPETITIONS,
  StandingRow,
} from '@/types/football';
import {
  FPF_COMPETITIONS,
  FPF_RESULTS_FEED_IDS,
  FPF_SITE_BASE,
  getFpfMetaForId,
} from '@/utils/fpfCompetitions';
import {
  buildFpfMatches,
  decodeHtmlEntities,
  parseFpfPage,
} from '@/utils/fpfParser';

export interface CompetitionInfo {
  id: number;
  title: string;
  logo: string;
  permalink: string;
}

/**
 * Fonte de dados:
 * - Lista de competições (nomes/logos): API /wp-json/mf/v3/competitions do site.
 * - Jogos, resultados e classificação: HTML renderizado pelo plugin
 *   "FPF Jogos Madeira" nas páginas /competicoes/{slug}/ (dados de resultados.fpf.pt).
 *   A API antiga /mf/v3/matches deixou de ter dados.
 */
const DEFAULT_API_BASES = [
  'https://madeirafutebol.com/wp-json/mf/v3',
  'https://www.madeirafutebol.com/wp-json/mf/v3',
] as const;

const envApiBase = process.env.EXPO_PUBLIC_RORK_API_BASE_URL?.trim() ?? '';

// Proxy server-side (Cloudflare Worker): contorna o CORS no preview web e
// reduz a carga no site em caso de falha do fetch direto.
const PROXY_BASE = process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL?.trim() ?? '';

const API_BASES = [envApiBase, ...DEFAULT_API_BASES].filter(
  (value, index, array) => value.length > 0 && array.indexOf(value) === index,
);

const HTTP_HEADERS: Record<string, string> =
  Platform.OS === 'web'
    ? { Accept: 'text/html,application/json' }
    : {
        Accept: 'text/html,application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
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

    try {
      const response = await fetch(url, { method: 'GET', headers: HTTP_HEADERS });

      if (!response.ok) {
        lastError = new Error(`Failed to fetch ${path}: ${response.status}`);
        continue;
      }

      return (await response.json()) as T;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error('Unknown request error');
      lastError = normalizedError;
    }
  }

  // Fallback: proxy server-side (resolve CORS no preview web / falhas diretas)
  try {
    return (await fetchViaProxy(path)) as T;
  } catch (proxyError) {
    lastError = proxyError instanceof Error ? proxyError : new Error('Proxy request error');
  }

  throw lastError ?? new Error(`Failed to fetch ${path}`);
}

/** Fallback via proxy Rork (usado quando o fetch direto falha, p. ex. CORS no web). */
async function fetchViaProxy(path: string): Promise<unknown> {
  if (!PROXY_BASE) throw new Error('No proxy base configured');

  const response = await fetch(`${PROXY_BASE}/fpf/competitions`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Proxy failed for ${path}: ${response.status}`);
  }

  return (await response.json()) as unknown;
}

// ---------------------------------------------------------------------------
// Páginas HTML do site (plugin FPF Jogos Madeira)
// ---------------------------------------------------------------------------

const PAGE_CACHE_TTL = 30 * 1000;
const pageCache = new Map<string, { html: string; at: number }>();

async function fetchFpfPage(slug: string): Promise<string> {
  const url = `${FPF_SITE_BASE}/competicoes/${slug}/`;
  const cached = pageCache.get(slug);
  const now = Date.now();

  if (cached && now - cached.at < PAGE_CACHE_TTL) {
    return cached.html;
  }

  let html: string;
  try {
    const response = await fetch(url, { method: 'GET', headers: HTTP_HEADERS });

    if (!response.ok) {
      throw new Error(`Failed to fetch competition page ${slug}: ${response.status}`);
    }

    html = await response.text();
  } catch (error) {
    // Web (CORS bloqueado), rate-limit ou rede indisponível → proxy server-side
    html = await fetchFpfPageViaProxy(slug);
  }

  pageCache.set(slug, { html, at: now });
  return html;
}

async function fetchFpfPageViaProxy(slug: string): Promise<string> {
  if (!PROXY_BASE) throw new Error('No proxy base configured');

  const response = await fetch(`${PROXY_BASE}/fpf/page?slug=${encodeURIComponent(slug)}`, {
    method: 'GET',
    headers: { Accept: 'text/html' },
  });

  if (!response.ok) {
    throw new Error(`Proxy failed for page ${slug}: ${response.status}`);
  }

  return response.text();
}

async function fetchFpfMatchesForCompetition(competitionId: number): Promise<APIMatch[]> {
  const meta = getFpfMetaForId(competitionId);
  if (!meta) return [];

  const html = await fetchFpfPage(meta.slug);
  const page = parseFpfPage(html);
  return buildFpfMatches(page.rounds, competitionId);
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

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

function getSafeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeText(value: string): string {
  return decodeHtmlEntities(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function isCupCompetitionName(value: string): boolean {
  const normalized = normalizeText(value);
  if (normalized.includes('taca') || normalized.includes('cup')) return true;
  // Competições com fases finais por eliminatórias
  if (normalized.includes('eliminatoria') || normalized.includes('play-off') || normalized.includes('playoff')) return true;
  return false;
}

/** Deteta formato eliminatório a partir dos jogos (mantido por compatibilidade). */
export function detectKnockoutFormat(matches: APIMatch[]): boolean {
  if (matches.length === 0) return false;

  let knockoutCount = 0;
  let leagueCount = 0;

  for (const match of matches) {
    const matchday = Number(match.matchday ?? 0);
    const roundId = Number(match.round_id ?? 0);

    if (roundId > 0 && matchday === 0) {
      knockoutCount++;
    } else if (matchday > 0) {
      leagueCount++;
    }
  }

  return knockoutCount > leagueCount && knockoutCount > 0;
}

function getFeaturedCompetitionMeta(competition: CompetitionInfo): {
  order: number;
  shortName: string;
  category: string;
} {
  const normalizedTitle = normalizeText(competition.title);

  if (
    normalizedTitle.includes('liga portugal 2') ||
    normalizedTitle.includes('ii liga') ||
    normalizedTitle.includes('segunda liga') ||
    normalizedTitle.includes('meu super')
  ) {
    return {
      order: 1,
      shortName: 'II Liga',
      category: 'seniores',
    };
  }

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

  const fallbackCategory = COMPETITION_CATEGORIES.find((item) =>
    item.aliases.some((alias) => normalizedTitle.includes(normalizeText(alias))),
  );

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
  try {
    const raw = await fetchApiJson<unknown>('/competitions');
    const data = normalizeCompetitionsPayload(raw);

    const mapped = data.map((item: Record<string, unknown>) => ({
      id: Number(item.id ?? 0),
      title: decodeHtmlEntities(getSafeString(item.name, getSafeString(item.title, 'Competição'))),
      logo: getSafeString(item.logo),
      permalink: getSafeString(item.permalink),
    }));

    if (mapped.length > 0) {
      return mapped;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.log(`[Competitions] API competitions failed (${message}), using local manifest`);
  }

  // Fallback: manifesto local das competições do site
  return FPF_COMPETITIONS.map((meta) => ({
    id: meta.id,
    title: meta.name,
    logo: meta.logo ?? '',
    permalink: `${FPF_SITE_BASE}/competicoes/${meta.slug}/`,
  }));
}

export function buildCompMap(competitions: CompetitionInfo[]): {
  nameMap: Record<number, string>;
  logoMap: Record<number, string>;
} {
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
  if (
    match.score1 !== null &&
    match.score1 !== undefined &&
    match.score2 !== null &&
    match.score2 !== undefined
  ) {
    const home = Number(match.score1);
    const away = Number(match.score2);

    if (!Number.isNaN(home) && !Number.isNaN(away)) {
      return { home, away };
    }
  }

  if (
    match.team1_score !== null &&
    match.team1_score !== undefined &&
    match.team2_score !== null &&
    match.team2_score !== undefined
  ) {
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
  if (match.result_final !== null && match.result_final !== undefined && match.result_final !== '') {
    return true;
  }
  if (match.winner_team_id !== null && match.winner_team_id !== undefined) return true;

  return false;
}

export function isMatchLive(match: APIMatch): boolean {
  return match.status === 'live';
}

function dedupeMatches(matches: APIMatch[]): APIMatch[] {
  const uniqueMatches = new Map<number, APIMatch>();

  matches.forEach((match) => {
    uniqueMatches.set(Number(match.id), match);
  });

  return Array.from(uniqueMatches.values()).sort(
    (a, b) => getMatchTimestamp(a.date) - getMatchTimestamp(b.date),
  );
}

// ---------------------------------------------------------------------------
// Jogos (feed de resultados: competições principais)
// ---------------------------------------------------------------------------

export async function fetchAllMatches(): Promise<APIMatch[]> {
  const settled = await Promise.allSettled(FPF_RESULTS_FEED_IDS.map((id) => fetchFpfMatchesForCompetition(id)));

  const matches: APIMatch[] = [];
  let lastError: unknown = null;

  settled.forEach((result) => {
    if (result.status === 'fulfilled') {
      matches.push(...result.value);
    } else {
      lastError = result.reason;
    }
  });

  if (matches.length === 0 && lastError) {
    const message = lastError instanceof Error ? lastError.message : 'unknown error';
    throw new Error(`Failed to fetch matches: ${message}`);
  }

  return dedupeMatches(matches);
}

export async function fetchResults(): Promise<APIMatch[]> {
  const matches = await fetchAllMatches();
  return matches.filter((match) => isMatchFinished(match) || isMatchLive(match));
}

export async function fetchFixtures(): Promise<APIMatch[]> {
  return fetchAllMatches();
}

export async function fetchAllMatchesMerged(): Promise<APIMatch[]> {
  return fetchAllMatches();
}

// ---------------------------------------------------------------------------
// Competição individual (estrutura nativa do plugin)
// ---------------------------------------------------------------------------

export async function fetchCompetitionStandings(competitionId: number): Promise<StandingRow[]> {
  const meta = getFpfMetaForId(competitionId);
  if (!meta) return [];

  const html = await fetchFpfPage(meta.slug);
  return parseFpfPage(html).standings;
}

/**
 * Devolve o detalhe da competição na estrutura nativa do plugin:
 * rondas (jornadas com número / eliminatórias com título) + classificação.
 */
export async function fetchCompetitionDetail(
  competitionId: number,
): Promise<CompetitionDetail> {
  const meta = getFpfMetaForId(competitionId);

  if (!meta) {
    return {
      competition: { id: competitionId, name: 'Competição', format: 'league' },
      rounds: [],
      standings: [],
    };
  }

  const html = await fetchFpfPage(meta.slug);
  const page = parseFpfPage(html);

  // Taças: nome com "taça"/"cup" ou rondas todas sem número (só títulos de eliminatória)
  const isCupFormat =
    isCupCompetitionName(meta.name) ||
    (page.rounds.length > 0 && page.rounds.every((round) => round.number === null));

  const allMatches = buildFpfMatches(page.rounds, competitionId);

  const rounds = page.rounds.map((round, index) => {
    const id = round.number ?? index + 1;
    return {
      id,
      label: round.label,
      number: round.number,
      matches: allMatches.filter((match) => match.matchday === id),
    };
  });

  return {
    competition: {
      id: competitionId,
      name: meta.name,
      logo: meta.logo,
      format: isCupFormat ? 'cup' : 'league',
    },
    rounds,
    standings: page.standings,
  };
}
