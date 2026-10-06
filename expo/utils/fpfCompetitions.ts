/**
 * Manifesto das competições do site MadeiraFutebol (plugin "FPF Jogos Madeira").
 *
 * Os dados já não estão disponíveis na API antiga (/wp-json/mf/v3/matches devolve
 * vazio); o site renderiza agora os jogos/resultados/classificação diretamente no
 * HTML das páginas de competição (/competicoes/{slug}/), vindos de resultados.fpf.pt.
 *
 * Este manifesto liga o ID da competição (da API /wp-json/mf/v3/competitions, que
 * continua ativa para nomes/logos) ao slug da página no site, permitindo ir buscar
 * o HTML de cada competição.
 */

export const FPF_SITE_BASE = 'https://www.madeirafutebol.com';

export interface FpfCompetitionMeta {
  id: number;
  slug: string;
  name: string;
  logo?: string;
}

const AF_MADEIRA_LOGO = 'https://www.madeirafutebol.com/wp-content/uploads/2023/09/afmadeira-32x32.png';

export const FPF_COMPETITIONS: FpfCompetitionMeta[] = [
  // Séniores / nacionais
  { id: 89399, slug: 'liga-portugal-betclic', name: 'Liga Portugal Betclic', logo: 'https://www.madeirafutebol.com/wp-content/uploads/2024/07/Liga-Portugal-Betclic-32x32.png' },
  { id: 71495, slug: 'taca-de-portugal', name: 'Taça de Portugal', logo: 'https://www.madeirafutebol.com/wp-content/uploads/2023/08/tacaplogo-32x32.png' },
  { id: 2161, slug: 'campeonato-de-portugal-serie-2', name: 'Campeonato de Portugal Série 2', logo: 'https://www.madeirafutebol.com/wp-content/uploads/2023/08/logocp-32x32.png' },
  { id: 1122, slug: 'liga-bpi', name: 'Campeonato Nacional Feminino BPI', logo: 'https://www.madeirafutebol.com/wp-content/uploads/2023/07/Liga-BPI-32x32.png' },
  { id: 27629, slug: 'liga-revelacao-serie-a', name: 'Liga Next Gen - 1ª Fase', logo: 'https://www.madeirafutebol.com/wp-content/uploads/2026/08/liga-revelecao-logo-32x32.png' },
  { id: 5702, slug: 'campeonato-nacional-juniores-a-ii-divisao', name: 'Campeonato Nacional II Divisão Jun.A – Série B', logo: 'https://www.madeirafutebol.com/wp-content/uploads/2023/08/junioresiidivisao-32x32.png' },

  // Séniores regionais
  { id: 73839, slug: 'divisao-honra-regional-seniores', name: 'Divisão Honra Regional - Seniores - Fut. 11', logo: AF_MADEIRA_LOGO },

  // Futsal
  { id: 78306, slug: 'taca-da-madeira-seniores-futsal-1fase', name: 'Taça da Madeira Seniores - Futsal 1.ª Fase', logo: AF_MADEIRA_LOGO },
  { id: 102866, slug: 'taca-da-madeira-futsal-juniores', name: 'Taça da Madeira Futsal de Juniores - 1ª Fase', logo: AF_MADEIRA_LOGO },
  { id: 73464, slug: 'taca-da-madeira-futsal-juvenis', name: 'Taça da Madeira Futsal de Juvenis - 1ª Fase', logo: AF_MADEIRA_LOGO },
  { id: 75416, slug: 'campeonato-divisao-de-honra-regional-iniciados-futsal', name: 'Campeonato Divisão de Honra Regional Iniciados - Futsal', logo: AF_MADEIRA_LOGO },
  { id: 60058, slug: 'camp-divisao-honra-regional-de-infantis-futsal-serie-a', name: 'C. D. Honra Regional de Infantis - Futsal - Série "A"', logo: AF_MADEIRA_LOGO },
  { id: 92462, slug: 'camp-divisao-honra-regional-de-infantis-futsal-serie-b', name: 'C. D. Honra Regional de Infantis - Futsal - Série "B"', logo: AF_MADEIRA_LOGO },
  { id: 92463, slug: 'camp-divisao-honra-regional-de-infantis-futsal-serie-c', name: 'C. D. Honra Regional de Infantis - Futsal - Série "C"', logo: AF_MADEIRA_LOGO },

  // Supertaças regionais
  { id: 102319, slug: 'supertaca-regional-iniciados-futebol', name: 'Supertaça Regional de Iniciados - Futebol', logo: AF_MADEIRA_LOGO },
  { id: 102305, slug: 'supertaca-regional-juniores-futebol', name: 'Supertaça Regional de Juniores - Futebol', logo: AF_MADEIRA_LOGO },
  { id: 102314, slug: 'supertaca-regional-juvenis-futebol', name: 'Supertaça Regional de Juvenis - Futebol', logo: AF_MADEIRA_LOGO },

  // Juniores
  { id: 71960, slug: 'campeonato-regional-1-divisao-juniores-fase', name: 'Camp. Regional 1.ª Divisão - Juniores - 1.ª Fase', logo: AF_MADEIRA_LOGO },
  { id: 82224, slug: 'campeonato-divisao-honra-regional-juniores-1-fase-serie-a', name: 'Camp. Div. Honra Regional - Juniores - 1.ª Fase - Série "A"', logo: AF_MADEIRA_LOGO },
  { id: 102347, slug: 'campeonato-divisao-honra-regional-juniores-1-fase-serie-b', name: 'Camp. Div. Honra Regional - Juniores - 1.ª Fase - Série "B"', logo: AF_MADEIRA_LOGO },

  // Juvenis
  { id: 102368, slug: 'campeonato-divisao-honra-regional-juvenis-1-fase-serie-a', name: 'Camp. Div. Honra Regional - Juvenis - 1.ª Fase - Série "A"', logo: AF_MADEIRA_LOGO },
  { id: 82280, slug: 'campeonato-divisao-honra-regional-juvenis-1-fase-serie-b', name: 'Camp. Div. Honra Regional - Juvenis - 1.ª Fase - Série "B"', logo: AF_MADEIRA_LOGO },
  { id: 72003, slug: 'campeonato-regional-1-divisao-juvenis-1-fase-serie-a', name: 'C.R. 1.ª Divisão - Juvenis - 1.ª Fase - Série “A”', logo: AF_MADEIRA_LOGO },
  { id: 72050, slug: 'campeonato-regional-1-divisao-juvenis-1-fase-serie-b', name: 'C.R. 1.ª Divisão - Juvenis - 1.ª Fase - Série “B”', logo: AF_MADEIRA_LOGO },

  // Iniciados
  { id: 72009, slug: 'campeonato-divisao-honra-regional-iniciados-1-fase-serie-a', name: 'C. D. H. Regional - Iniciados - 1.ª Fase - Série "A"', logo: AF_MADEIRA_LOGO },
  { id: 72016, slug: 'campeonato-divisao-honra-regional-iniciados-1-fase-serie-b', name: 'C. D. H. Regional - Iniciados - 1.ª Fase - Série "B"', logo: AF_MADEIRA_LOGO },
  { id: 72025, slug: 'campeonato-regional-1-divisao-iniciados-1-fase-serie-a', name: 'C. R. 1.ª Divisão - Iniciados - 1.ª Fase – Série “A”', logo: AF_MADEIRA_LOGO },
  { id: 72026, slug: 'campeonato-regional-1-divisao-iniciados-1-fase-serie-b', name: 'C. R. 1.ª Divisão - Iniciados - 1.ª Fase – Série “B”', logo: AF_MADEIRA_LOGO },
  { id: 82364, slug: 'campeonato-regional-1-divisao-iniciados-1-fase-serie-c', name: 'C. R. 1.ª Divisão - Iniciados - 1.ª Fase – Série “C”', logo: AF_MADEIRA_LOGO },
  { id: 102842, slug: 'campeonato-regional-1-divisao-iniciados-1-fase-serie-d', name: 'C. R. 1.ª Divisão - Iniciados - 1.ª Fase – Série “D”', logo: AF_MADEIRA_LOGO },

  // Infantis Sub-13
  { id: 53295, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-13-1fase-serie-a1', name: 'Campeonato Divisão Honra Regional de Infantis Sub-13 - Fut.8 - 1ªF Série "A1"', logo: AF_MADEIRA_LOGO },
  { id: 72525, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-13-1fase-serie-a2', name: 'Campeonato Divisão Honra Regional de Infantis Sub-13 - Fut.8 - 1ªF Série "A2"', logo: AF_MADEIRA_LOGO },
  { id: 65412, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-13-1fase-serie-a3', name: 'Campeonato Divisão Honra Regional de Infantis Sub-13 - Fut.8 - 1ªF Série "A3"', logo: AF_MADEIRA_LOGO },
  { id: 91079, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-13-1fase-serie-b2', name: 'Campeonato Divisão Honra Regional de Infantis Sub-13 - Fut.8 - 1ªF Série "B2"', logo: AF_MADEIRA_LOGO },
  { id: 102721, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-13-1fase-serie-b3', name: 'Campeonato Divisão Honra Regional de Infantis Sub-13 - Fut.8 - 1ªF Série "B3"', logo: AF_MADEIRA_LOGO },
  { id: 102725, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-13-1fase-serie-c1', name: 'Campeonato Divisão Honra Regional de Infantis Sub-13 - Fut.8 - 1ªF Série "C1/C2"', logo: AF_MADEIRA_LOGO },
  { id: 2446, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-13-1fase-serie-d', name: 'Campeonato Divisão Honra Regional de Infantis Sub-13 - Fut.8 - 1ªF Série "B1"', logo: AF_MADEIRA_LOGO },

  // Infantis Sub-12 (Futebol 7)
  { id: 102734, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-12-1fase-serie-a1', name: 'Campeonato Divisão Honra Regional de Infantis Sub-12 – Futebol 7 – 1ªF Série “A1”', logo: AF_MADEIRA_LOGO },
  { id: 72564, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-12-1fase-serie-a2', name: 'Campeonato Divisão Honra Regional de Infantis Sub-12 - Futebol 7 - 1ªF Série "A2"', logo: AF_MADEIRA_LOGO },
  { id: 102761, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-12-1fase-seriea3', name: 'Campeonato Divisão Honra Regional de Infantis Sub-12 – Futebol 7 – 1ªF Série “A3”', logo: AF_MADEIRA_LOGO },
  { id: 82675, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-12-1fase-serie-b1', name: 'Campeonato Divisão Honra Regional de Infantis Sub-12 - Futebol 7 - 1ªF Série "B1"', logo: AF_MADEIRA_LOGO },
  { id: 102736, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-12-1fase-serie-b2', name: 'Campeonato Divisão Honra Regional de Infantis Sub-12 - Futebol 7 - 1ªF Série "B2"', logo: AF_MADEIRA_LOGO },
  { id: 102738, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-12-1fase-serie-b3', name: 'Campeonato Divisão Honra Regional de Infantis Sub-12 - Futebol 7 - 1ªF Série "B3"', logo: AF_MADEIRA_LOGO },
  { id: 102737, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-12-1fase-serie-c1', name: 'Campeonato Divisão Honra Regional de Infantis Sub-12 - Futebol 7 - 1ªF Série "C1"', logo: AF_MADEIRA_LOGO },
  { id: 102741, slug: 'campeonato-divisao-honra-regional-de-infantis-sub-12-1fase-serie-c2-c3', name: 'Campeonato Divisão Honra Regional de Infantis Sub-12 - Futebol 7 - 1ªF Série "C2/C3"', logo: AF_MADEIRA_LOGO },

  // Torneio da Madeira (Benjamins SUB-11)
  { id: 72623, slug: 'torneio-da-madeira-i-sub-11-1fase-serie-a', name: 'Torneio da Madeira I - Benjamins SUB-11 - Fut.7 - 1ªF Série "A"', logo: AF_MADEIRA_LOGO },
  { id: 72624, slug: 'torneio-da-madeira-i-sub-11-1fase-serie-b', name: 'Torneio da Madeira I - Benjamins SUB-11 - Fut. 7 - 1ªF Série "B"', logo: AF_MADEIRA_LOGO },
  { id: 91454, slug: 'torneio-da-madeira-i-sub-11-1fase-serie-c', name: 'Torneio da Madeira I - Benjamins SUB-11 - Fut. 7 - 1ªF Série "C"', logo: AF_MADEIRA_LOGO },
];

/**
 * Competições incluídas no feed de resultados (ecrã Resultados, filtro por data).
 * Inclui todas as competições do manifesto — incluindo supertaças — para que
 * nenhum jogo fique de fora de nenhum dia.
 */
export const FPF_RESULTS_FEED_IDS: number[] = FPF_COMPETITIONS.map((item) => item.id);

export function getFpfMetaForId(id: number): FpfCompetitionMeta | null {
  return FPF_COMPETITIONS.find((item) => item.id === id) ?? null;
}

export function getFpfMetaForSlug(slug: string): FpfCompetitionMeta | null {
  return FPF_COMPETITIONS.find((item) => item.slug === slug) ?? null;
}
