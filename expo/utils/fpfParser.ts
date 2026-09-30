import { APIMatch, StandingRow } from '@/types/football';

/**
 * Parser do HTML renderizado pelo plugin "FPF Jogos Madeira" nas páginas
 * de competição do site madeirafutebol.com.
 *
 * Estrutura esperada:
 * - Blocos de jornada: <div data-fpf-jornada="N" ...><div class="fpf-jornada-title">...</div>
 *   <article class="fpf-jogo">...</article>...</div>
 *   (em taças, os blocos não têm data-fpf-jornada; o título é o nome da eliminatória)
 * - Jogos: <article class="fpf-jogo"> com .fpf-equipa.fpf-casa, .fpf-centro
 *   (.fpf-resultado para jogos com resultado, ou .fpf-data + .fpf-hora / .fpf-datahora
 *   para jogos agendados), .fpf-equipa.fpf-fora e .fpf-estadio
 * - Classificação: <table class="fpf-classificacao-table"> com colunas
 *   POS, Equipa, JGS, V, E, D, GM, GS, PTS
 */

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '\u2026')
    .trim();
}

function stripHtmlTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDiv(html: string, className: string): string | null {
  const regex = new RegExp(`class="${className}"[^>]*>([\\s\\S]*?)</div>`);
  const match = html.match(regex);
  return match ? stripHtmlTags(match[1]) : null;
}

const MONTHS: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
};

/** Escolhe o ano mais próximo de "agora" para uma data sem ano ("16 mai"). */
function inferYear(month: number): number {
  const now = Date.now();
  const currentYear = new Date(now).getFullYear();

  let bestYear = currentYear;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const year of [currentYear - 1, currentYear, currentYear + 1]) {
    const candidate = new Date(year, month, 1).getTime();
    const diff = Math.abs(candidate - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestYear = year;
    }
  }

  return bestYear;
}

/**
 * Converte a data do site ("16 mai" + "15:30") numa data ISO local
 * ("YYYY-MM-DD HH:mm:ss"), inferindo o ano pelo calendário atual.
 */
export function resolveFpfDate(dateText: string, timeText: string | null): string | null {
  const match = dateText.trim().match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
  if (month === undefined || day < 1 || day > 31) return null;

  const year = inferYear(month);
  const timeMatch = timeText?.trim().match(/^(\d{1,2}):(\d{2})$/);
  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)} ${pad(hour)}:${pad(minute)}:00`;
}

export interface FpfParsedMatch {
  home: string;
  away: string;
  score: { home: number; away: number } | null;
  date: string | null;
  stadium: string | null;
}

export interface FpfRoundData {
  label: string;
  number: number | null;
  matches: FpfParsedMatch[];
}

export interface FpfPageData {
  rounds: FpfRoundData[];
  standings: StandingRow[];
}

function parseArticle(html: string): FpfParsedMatch | null {
  const home = extractDiv(html, 'fpf-equipa fpf-casa');
  const away = extractDiv(html, 'fpf-equipa fpf-fora');
  if (!home || !away) return null;

  const resultText = extractDiv(html, 'fpf-resultado');
  const dateText = extractDiv(html, 'fpf-datahora') ?? extractDiv(html, 'fpf-data');
  const timeText = extractDiv(html, 'fpf-hora');
  const stadium = extractDiv(html, 'fpf-estadio');

  let score: { home: number; away: number } | null = null;
  if (resultText) {
    const parts = resultText.split(/[-–:xX]/);
    if (parts.length === 2) {
      const homeScore = parseInt(parts[0].trim(), 10);
      const awayScore = parseInt(parts[1].trim(), 10);
      if (!Number.isNaN(homeScore) && !Number.isNaN(awayScore)) {
        score = { home: homeScore, away: awayScore };
      }
    }
  }

  return {
    home,
    away,
    score,
    date: dateText ? resolveFpfDate(dateText, timeText) : null,
    stadium,
  };
}

function parseStandings(html: string): StandingRow[] {
  const rows: StandingRow[] = [];

  const tables = [...html.matchAll(/<table class="fpf-classificacao-table">([\s\S]*?)<\/table>/g)];
  tables.forEach((tableMatch) => {
    const trMatches = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];

    trMatches.forEach((trMatch) => {
      const cells = [...trMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) =>
        stripHtmlTags(cell[1]),
      );

      if (cells.length < 9) return;

      const [position, teamName, played, won, drawn, lost, goalsFor, goalsAgainst, points] = cells;
      if (!teamName || !/^\d+$/.test(position)) return;

      const toInt = (value: string) => {
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
      };

      const gf = toInt(goalsFor);
      const ga = toInt(goalsAgainst);

      rows.push({
        teamId: teamName,
        teamName,
        teamLogo: '',
        played: toInt(played),
        won: toInt(won),
        drawn: toInt(drawn),
        lost: toInt(lost),
        goalsFor: gf,
        goalsAgainst: ga,
        goalDifference: gf - ga,
        points: toInt(points),
      });
    });
  });

  return rows.sort(
    (a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor,
  );
}

/** Analisa uma página de competição e devolve jornadas/eliminatórias + classificação. */
export function parseFpfPage(html: string): FpfPageData {
  const standingsStart = html.indexOf('fpf-classificacao');
  const matchesHtml = standingsStart >= 0 ? html.slice(0, standingsStart) : html;
  const standingsHtml = standingsStart >= 0 ? html.slice(standingsStart) : '';

  const numRegex = /data-fpf-jornada="(\d+)"/g;
  const roundNumbers = [...matchesHtml.matchAll(numRegex)].map((m) => ({
    pos: m.index ?? 0,
    num: Number(m[1]),
  }));

  const titleRegex = /fpf-jornada-title">([^<]*)</g;
  const titles = [...matchesHtml.matchAll(titleRegex)].map((m) => ({
    pos: m.index ?? 0,
    text: m[1].trim(),
  }));

  const rounds: FpfRoundData[] = [];

  titles.forEach((title, index) => {
    const segmentStart = title.pos;
    const segmentEnd = index + 1 < titles.length ? titles[index + 1].pos : matchesHtml.length;
    const previousTitlePos = index > 0 ? titles[index - 1].pos : 0;

    const roundNumber = roundNumbers
      .filter((item) => item.pos > previousTitlePos && item.pos < title.pos)
      .pop()?.num ?? null;

    const segment = matchesHtml.slice(segmentStart, segmentEnd);
    const articleMatches = [...segment.matchAll(/<article class="fpf-jogo">([\s\S]*?)<\/article>/g)];
    const matches = articleMatches
      .map((article) => parseArticle(article[1]))
      .filter((item): item is FpfParsedMatch => item !== null);

    const genericTitle = /^(jogos?|resultados?|calend[aá]rio|fixtures?)$/i.test(title.text);
    const label =
      roundNumber !== null && genericTitle
        ? `Jornada ${roundNumber}`
        : title.text || (roundNumber !== null ? `Jornada ${roundNumber}` : 'Jogos');

    rounds.push({ label, number: roundNumber, matches });
  });

  return { rounds, standings: parseStandings(standingsHtml) };
}

/** Hash estável para gerar IDs determinísticos de jogos (não existe ID na fonte). */
function stableHash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

/** Converte as rondas analisadas em APIMatch[] compatível com os ecrãs existentes. */
export function buildFpfMatches(rounds: FpfRoundData[], competitionId: number): APIMatch[] {
  const matches: APIMatch[] = [];

  rounds.forEach((round, index) => {
    const matchday = round.number ?? index + 1;

    round.matches.forEach((match) => {
      const scoreText = match.score ? `${match.score.home} - ${match.score.away}` : null;
      const id = stableHash(
        `${competitionId}|${matchday}|${match.home}|${match.away}|${match.date ? match.date.slice(0, 10) : 'nodate'}`,
      );

      matches.push({
        id,
        competition_id: competitionId,
        matchday,
        round_id: String(matchday),
        title: `${match.home} x ${match.away}`,
        team1: match.home,
        team2: match.away,
        score: scoreText,
        result_final: scoreText,
        status: match.score ? 'finished' : 'scheduled',
        date: match.date ?? '',
      });
    });
  });

  return matches.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
